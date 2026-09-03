import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAdmin } from '@/lib/guard';
import { logAudit, clientIp } from '@/lib/audit';
import { ok, fail, readJson } from '@/lib/api';
import {
  validateMeeting, MEETING_TYPE_KEYS, STATUSES, DURATION_MIN, DURATION_MAX,
} from '@/lib/meetings';
import {
  newRoomId, resolveAudience, inviteMembers, participantsOf, hostsOf,
  notifyMeeting, sweepLifecycle, withDerived, MEMBER_FIELDS,
} from '@/lib/meetingsServer';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const HINT = 'Administrator: run supabase/migration_meetings.sql.';

/* Admin management of TNR Meetings.
 *
 * Reached under the `meetings` permission area (lib/adminScopes.js), enforced
 * centrally in requireAdmin — this file does not re-implement that check, and
 * must not, because a route with its own copy of the rule is a route that can
 * drift from it.
 */

// ── List + dashboard counts ────────────────────────────────────────────────
export async function GET(req) {
  const { res } = requireAdmin(req); if (res) return res;
  const p = new URL(req.url).searchParams;
  const status = (p.get('status') || '').trim();
  const type = (p.get('type') || '').trim();
  const one = (p.get('id') || '').trim();

  const sb = supabaseAdmin();

  // Correct anything the clock has overtaken before counting it. See
  // sweepLifecycle for why this happens on read rather than on a schedule.
  await sweepLifecycle().catch(() => {});

  // ── One meeting, in full ──
  if (one) {
    const { data: m } = await sb.from('meetings').select('*').eq('id', one).maybeSingle();
    if (!m) return fail('NOT_FOUND', 404, { message: 'Meeting not found.' });
    const [{ host, coHosts }, participants] = await Promise.all([
      hostsOf(m), participantsOf(m.id),
    ]);
    return ok({ meeting: withDerived(m), host, coHosts, participants });
  }

  // ── The table ──
  let q = sb.from('meetings').select('*').order('scheduled_at', { ascending: false }).limit(500);
  if (STATUSES.includes(status)) q = q.eq('status', status);
  if (MEETING_TYPE_KEYS.includes(type)) q = q.eq('meeting_type', type);

  const { data, error } = await q;
  if (error) return ok({ meetings: [], counts: {}, hint: HINT, detail: error.message });

  const rows = data || [];

  // Hosts and participant counts for the whole page in two queries rather than
  // two per row.
  let hosts = {}, counts = {};
  if (rows.length) {
    const [{ data: hs }, { data: ps }] = await Promise.all([
      sb.from('membership_members').select(MEMBER_FIELDS)
        .in('id', [...new Set(rows.map(r => r.host_id).filter(Boolean))]),
      sb.from('meeting_participants').select('meeting_id, invite_status')
        .in('meeting_id', rows.map(r => r.id)),
    ]);
    hosts = Object.fromEntries((hs || []).map(h => [h.id, h]));
    for (const r of (ps || [])) {
      const c = counts[r.meeting_id] || (counts[r.meeting_id] = { total: 0, joined: 0 });
      c.total += 1;
      if (r.invite_status === 'joined') c.joined += 1;
    }
  }

  const stats = { total: rows.length };
  for (const s of STATUSES) stats[s] = rows.filter(r => r.status === s).length;

  return ok({
    stats,
    meetings: rows.map(m => ({
      ...withDerived(m),
      host: hosts[m.host_id] || null,
      participant_count: counts[m.id]?.total || 0,
      joined_count: counts[m.id]?.joined || 0,
    })),
  });
}

// ── Create / update / cancel ───────────────────────────────────────────────
export async function POST(req) {
  const { admin, res } = requireAdmin(req); if (res) return res;
  const b = await readJson(req);
  const sb = supabaseAdmin();

  // ── Cancel: its own action, never a free-form status write ──
  if (b.action === 'cancel') {
    if (!b.id) return fail('INVALID', 400, { message: 'Missing meeting.' });
    const { data: m } = await sb.from('meetings').select('*').eq('id', b.id).maybeSingle();
    if (!m) return fail('NOT_FOUND', 404, { message: 'Meeting not found.' });
    if (m.status === 'cancelled')
      return ok({ meeting: withDerived(m), unchanged: true, message: 'Already cancelled.' });

    const { data: updated } = await sb.from('meetings').update({
      status: 'cancelled',
      cancelled_reason: String(b.reason || '').trim().slice(0, 300) || null,
    }).eq('id', b.id).select('*').single();

    const notice = await notifyMeeting(updated, 'cancelled');
    await logAudit({
      action: 'MEETING_CANCELLED', actor: admin?.username || 'admin',
      details: updated.title.slice(0, 200), ip: clientIp(req),
    });
    return ok({
      meeting: withDerived(updated),
      message: `Meeting cancelled. ${notice.sent} participant(s) notified.`,
    });
  }

  // ── Create / edit ──
  const check = validateMeeting(b);
  if (!check.ok) return fail('INVALID', 400, { errors: check.errors });

  // The host must be a real, active member — otherwise a meeting can be
  // created in the name of a suspended account that can never start it.
  const { data: host } = await sb.from('membership_members')
    .select('id, full_name, status').eq('id', b.host_id).is('deleted_at', null).maybeSingle();
  if (!host) return fail('INVALID', 400, { errors: { host_id: 'Host not found.' } });
  if (host.status !== 'active')
    return fail('INVALID', 400, { errors: { host_id: `${host.full_name} is not an active member.` } });

  const coHosts = [...new Set((b.co_host_ids || []).map(String))]
    .filter(id => id !== String(b.host_id));   // host is not also a co-host

  const patch = {
    title: String(b.title).trim().slice(0, 160),
    description: txt(b.description),
    agenda: txt(b.agenda),
    meeting_type: b.meeting_type,
    scheduled_at: new Date(b.scheduled_at).toISOString(),
    duration_minutes: Math.min(DURATION_MAX, Math.max(DURATION_MIN, Number(b.duration_minutes) || 60)),
    host_id: b.host_id,
    co_host_ids: coHosts,
    waiting_room_enabled: b.waiting_room_enabled !== false,
    recording_enabled: !!b.recording_enabled,
    chat_enabled: b.chat_enabled !== false,
    screen_share_enabled: b.screen_share_enabled !== false,
    join_before_host: !!b.join_before_host,
  };

  /* Passcode. Hashed, never stored or returned in the clear — a meeting
   * password is often a string the member uses elsewhere, and the admin table
   * is read by more people than the meeting is attended by.
   *
   * An empty string means "remove it"; undefined means "leave it alone", so
   * editing the agenda does not silently drop the passcode. */
  if (b.password !== undefined) {
    const pw = String(b.password || '').trim();
    patch.password_hash = pw ? await bcrypt.hash(pw, 10) : null;
  }

  let row;
  if (b.id) {
    const { data: before } = await sb.from('meetings').select('*').eq('id', b.id).maybeSingle();
    if (!before) return fail('NOT_FOUND', 404, { message: 'Meeting not found.' });

    const { data, error } = await sb.from('meetings')
      .update(patch).eq('id', b.id).select('*').single();
    if (error) return fail('SAVE_FAILED', 500, { message: 'Could not save.', detail: error.message, hint: HINT });
    row = data;

    // Only announce a move if the time actually moved. An admin fixing a typo
    // in the agenda must not send 293 people a "rescheduled" notice.
    const moved = new Date(before.scheduled_at).getTime() !== new Date(row.scheduled_at).getTime();
    if (moved) await notifyMeeting(row, 'rescheduled');

    await logAudit({
      action: 'MEETING_UPDATED', actor: admin?.username || 'admin',
      details: row.title.slice(0, 200), ip: clientIp(req),
    });
  } else {
    patch.status = 'scheduled';
    patch.room_id = newRoomId();
    patch.provider = 'livekit';
    patch.created_by = admin?.username || 'admin';

    const { data, error } = await sb.from('meetings').insert(patch).select('*').single();
    if (error) return fail('SAVE_FAILED', 500, { message: 'Could not create.', detail: error.message, hint: HINT });
    row = data;

    await logAudit({
      action: 'MEETING_CREATED', actor: admin?.username || 'admin',
      details: `${row.meeting_type}: ${row.title}`.slice(0, 200), ip: clientIp(req),
    });
  }

  /* Invitations.
   *
   * The host and co-hosts are always on the list, in their own capacity, so a
   * host never has to be invited to their own meeting and can never be left
   * off it by an admin who forgot. */
  let invited = { added: 0 }, notice = { sent: 0 };
  const targets = Array.isArray(b.audience) ? b.audience : [];
  const explicit = Array.isArray(b.member_ids) ? b.member_ids : [];

  if (targets.length || explicit.length || !b.id) {
    const people = await resolveAudience(targets, explicit);
    const staff = [
      { id: row.host_id, via: 'host', role: 'host' },
      ...coHosts.map(id => ({ id, via: 'co_host', role: 'co_host' })),
    ];
    // Staff first so their role wins if they also appear in a group target.
    invited = await inviteMembers(row.id, [
      ...staff,
      ...people.filter(p => !staff.some(s => String(s.id) === String(p.id))),
    ]);

    if (!b.id && invited.added) notice = await notifyMeeting(row, 'created');
  }

  return ok({
    meeting: withDerived(row),
    invited: invited.added,
    notified: notice.sent,
    message: b.id
      ? 'Meeting updated.'
      : `Meeting scheduled. ${invited.added} participant(s) invited, ${notice.sent} notified.`,
  });
}

// ── Delete ─────────────────────────────────────────────────────────────────
export async function DELETE(req) {
  const { admin, res } = requireAdmin(req); if (res) return res;
  const id = String(new URL(req.url).searchParams.get('id') || '').trim();
  if (!id) return fail('INVALID', 400, { message: 'Missing meeting.' });

  const sb = supabaseAdmin();
  const url = new URL(req.url);
  const force = url.searchParams.get('force') === '1';

  const { data: m } = await sb.from('meetings').select('title, status').eq('id', id).maybeSingle();
  if (!m) return fail('NOT_FOUND', 404, { message: 'Meeting not found.' });

  // A meeting still running is never deletable — people are in the room.
  if (m.status === 'live')
    return fail('IS_LIVE', 409, {
      message: 'This meeting is running. End it first.',
    });

  /* Deleting a meeting that HAPPENED erases its record.
   *
   * The cascade takes the attendance, the minutes and the action items with
   * it — the organisational record of what a committee resolved, which is the
   * reason the meeting was held. So it is a two-step: the first request
   * refuses and reports exactly what would be lost, and only a request that
   * has seen those numbers and says `force` goes through.
   *
   * Not a flat refusal, because that left test meetings stuck in the list
   * forever with no way to clear them. An administrator is allowed to delete
   * their own organisation's data — they are not allowed to do it by accident. */
  const at = async (table) => (await sb.from(table)
    .select('id', { count: 'exact', head: true }).eq('meeting_id', id)).count || 0;

  const [sessions, attendance, minutes, documents, actions] = await Promise.all([
    at('meeting_attendance_sessions'), at('meeting_attendance'),
    at('meeting_minutes'), at('meeting_documents'), at('meeting_action_items'),
  ]);
  const records = sessions + attendance + minutes + documents + actions;

  if (records > 0 && !force) {
    return fail('HAS_RECORD', 409, {
      needs_force: true,
      counts: { attendance, sessions, minutes, documents, action_items: actions },
      message: 'This meeting has a record attached.',
    });
  }

  const { error } = await sb.from('meetings').delete().eq('id', id);
  if (error) return fail('DELETE_FAILED', 500, { message: 'Could not delete.' });

  await logAudit({
    action: 'MEETING_DELETED', actor: admin?.username || 'admin',
    details: m.title?.slice(0, 200), ip: clientIp(req),
  });
  return ok({ message: 'Meeting deleted.' });
}

const txt = (v) => { const s = String(v ?? '').trim(); return s || null; };
