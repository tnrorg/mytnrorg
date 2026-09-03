import 'server-only';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { notifyMembers } from '@/lib/notify';
import {
  effectiveStatus, endsAt, typeLabel, fmtDateTime, AUDIENCE_KEYS,
} from '@/lib/meetings';

/* Server-side meeting operations.
 *
 * Everything here runs with the service-role key, which bypasses RLS. That
 * makes each function in this file a security boundary in its own right: the
 * caller has already been authenticated by requireMember / requireAdmin, and
 * these functions must not widen what that caller can see or do.
 */

// Columns safe to return about a member anywhere in this module. Explicit, so
// no route can widen it to select('*') and start shipping mobile numbers,
// CNICs and addresses into a participant list.
export const MEMBER_FIELDS =
  'id, membership_id, full_name, photo_url, role, union_council, status';

/* An unguessable room name.
 *
 * Deliberately not the meeting's uuid. The uuid travels in URLs, in the admin
 * table and in server logs; anyone who has seen one could try to open the room
 * directly at the provider. This is generated once at creation and only ever
 * handed out alongside a token the server minted for a verified participant.
 */
export const newRoomId = () => `tnr-${crypto.randomBytes(9).toString('hex')}`;

// ── Reading one meeting, with the caller's standing in it ──────────────────
/**
 * Load a meeting and the caller's participation row in a single place.
 *
 * Returns `{ meeting, participation }`, or nulls. Callers decide what to do
 * with "invited but not host" — but they all get the same answer to "is this
 * person actually on this meeting", so no route can invent its own looser
 * version of that question.
 */
export async function loadMeetingFor(meetingId, memberId) {
  if (!meetingId) return { meeting: null, participation: null };
  const sb = supabaseAdmin();

  const { data: meeting } = await sb.from('meetings')
    .select('*').eq('id', meetingId).maybeSingle();
  if (!meeting) return { meeting: null, participation: null };

  let participation = null;
  if (memberId) {
    const { data } = await sb.from('meeting_participants')
      .select('*').eq('meeting_id', meetingId).eq('member_id', memberId).maybeSingle();
    participation = data || null;
  }
  return { meeting, participation };
}

/** Host and co-hosts, resolved to displayable people. */
export async function hostsOf(meeting) {
  if (!meeting) return { host: null, coHosts: [] };
  const sb = supabaseAdmin();
  const ids = [meeting.host_id, ...(meeting.co_host_ids || [])].filter(Boolean);
  if (!ids.length) return { host: null, coHosts: [] };

  const { data } = await sb.from('membership_members').select(MEMBER_FIELDS).in('id', ids);
  const by = Object.fromEntries((data || []).map(m => [m.id, m]));
  return {
    host: by[meeting.host_id] || null,
    coHosts: (meeting.co_host_ids || []).map(id => by[id]).filter(Boolean),
  };
}

// ── Turning a group target into people ─────────────────────────────────────
/**
 * Resolve audience selections to member ids.
 *
 * Only ACTIVE, non-deleted members are ever returned. Inviting a suspended
 * account would put someone who cannot sign in on the list, and then mark them
 * absent when they inevitably fail to attend.
 *
 * @param {Array<{kind:string, value?:string}>} targets
 * @param {string[]} explicitIds  individually picked members
 */
export async function resolveAudience(targets = [], explicitIds = []) {
  const sb = supabaseAdmin();
  const found = new Map();   // id -> which target brought them in

  const add = (rows, via) => {
    for (const r of rows || []) if (!found.has(r.id)) found.set(r.id, via);
  };

  const base = () => sb.from('membership_members')
    .select('id').eq('status', 'active').is('deleted_at', null);

  for (const t of targets) {
    const kind = String(t?.kind || '').trim();
    if (!AUDIENCE_KEYS.includes(kind)) continue;      // unknown target → ignored, never "everyone"

    if (kind === 'all') {
      const { data } = await base();
      add(data, 'all');
    } else if (kind === 'uc') {
      const uc = String(t.value || '').trim();
      if (!uc) continue;
      const { data } = await base().eq('union_council', uc);
      add(data, `uc:${uc}`);
    } else {
      // advisory | cec | uc_team | general — these ARE the role keys.
      const { data } = await base().eq('role', kind);
      add(data, kind);
    }
  }

  if (explicitIds.length) {
    const { data } = await base().in('id', [...new Set(explicitIds.map(String))]);
    add(data, 'manual');
  }

  return [...found.entries()].map(([id, via]) => ({ id, via }));
}

// ── Invitations ────────────────────────────────────────────────────────────
/**
 * Put people on a meeting.
 *
 * Upserts on (meeting_id, member_id), so overlapping targets — "all members"
 * plus "Advisory Council" — collapse to one row per person rather than two
 * notifications and two attendance records. `ignoreDuplicates` keeps an
 * existing row's invite_status: someone who already accepted must not be reset
 * to 'invited' because an admin re-ran the group invite.
 */
export async function inviteMembers(meetingId, people, defaultRole = 'participant') {
  if (!meetingId || !people?.length) return { added: 0 };
  const sb = supabaseAdmin();

  const rows = people.map(p => ({
    meeting_id: meetingId,
    member_id: p.id,
    role: p.role || defaultRole,
    invited_via: p.via || 'manual',
  }));

  let added = 0;
  for (let i = 0; i < rows.length; i += 200) {
    const { data, error } = await sb.from('meeting_participants')
      .upsert(rows.slice(i, i + 200), { onConflict: 'meeting_id,member_id', ignoreDuplicates: true })
      .select('member_id');
    if (!error) added += (data || []).length;
  }
  return { added };
}

/** Everyone currently invited, for notifications and the participant list. */
export async function participantsOf(meetingId, { withMembers = true } = {}) {
  const sb = supabaseAdmin();
  const { data: rows } = await sb.from('meeting_participants')
    .select('*').eq('meeting_id', meetingId).order('created_at');
  const list = rows || [];
  if (!withMembers || !list.length) return list;

  const { data: mem } = await sb.from('membership_members')
    .select(MEMBER_FIELDS).in('id', [...new Set(list.map(r => r.member_id))]);
  const by = Object.fromEntries((mem || []).map(m => [m.id, m]));
  return list.map(r => ({ ...r, member: by[r.member_id] || null }));
}

// ── Notifications ──────────────────────────────────────────────────────────
/* Reuses membership_notifications through lib/notify.js. No second
 * notification system, no second bell, no second unread count. */
export const MEETING_NOTICES = {
  created:     (m) => [`${typeLabel(m.meeting_type)} scheduled`,
    `${m.title} — ${fmtDateTime(m.scheduled_at)}.`],
  reminder:    (m) => ['Your meeting starts soon',
    `${m.title} begins at ${fmtDateTime(m.scheduled_at)}.`],
  started:     (m) => ['A meeting is now live',
    `${m.title} has started. Join from My Meetings.`],
  cancelled:   (m) => ['Meeting cancelled',
    `${m.title}, scheduled for ${fmtDateTime(m.scheduled_at)}, has been cancelled.`],
  rescheduled: (m) => ['Meeting rescheduled',
    `${m.title} has moved to ${fmtDateTime(m.scheduled_at)}.`],
  completed:   (m) => ['Meeting completed',
    `${m.title} has ended. Minutes and attendance will appear on the meeting record.`],
};

export async function notifyMeeting(meeting, kind, { actorId, memberIds } = {}) {
  const build = MEETING_NOTICES[kind];
  if (!build || !meeting) return { sent: 0 };

  const ids = memberIds
    || (await participantsOf(meeting.id, { withMembers: false })).map(p => p.member_id);

  const [title, body] = build(meeting);
  return notifyMembers(ids, {
    actorId, title, body,
    link: `/member/meetings/${meeting.id}`,
    category: 'meeting',
  });
}

// ── Lifecycle ──────────────────────────────────────────────────────────────
/**
 * Bring stored statuses in line with the clock.
 *
 * lib/meetings.js derives the honest status for DISPLAY, so a screen is never
 * wrong. This writes it down, which matters for two things a derived value
 * cannot do: the admin dashboard counts, and the "missed" marks that decide
 * what a member sees in their own list.
 *
 * Called opportunistically on list reads rather than by a cron job — this
 * project has no scheduler, and a sweep that only runs when someone is looking
 * is enough for counts that only matter when someone is looking. It never
 * touches a cancelled meeting, and never resurrects one a human ended.
 */
export async function sweepLifecycle() {
  const sb = supabaseAdmin();
  const now = new Date();

  const { data: open } = await sb.from('meetings')
    .select('id, status, scheduled_at, duration_minutes, started_at, ended_at')
    .in('status', ['scheduled', 'live'])
    .lt('scheduled_at', now.toISOString());
  if (!open?.length) return { closed: 0 };

  const stale = open.filter(m => effectiveStatus(m, now.getTime()) === 'completed');
  if (!stale.length) return { closed: 0 };

  await sb.from('meetings').update({
    status: 'completed',
    // Only fill ended_at if nobody set it: a host who pressed End Meeting
    // recorded the real instant, and the sweep must not overwrite it with a
    // guess derived from the scheduled duration.
    ended_at: now.toISOString(),
  }).in('id', stale.filter(m => !m.ended_at).map(m => m.id));

  await sb.from('meetings').update({ status: 'completed' })
    .in('id', stale.filter(m => m.ended_at).map(m => m.id));

  // Anyone still sitting at 'invited' on a finished meeting did not come.
  await sb.from('meeting_participants')
    .update({ invite_status: 'missed' })
    .in('meeting_id', stale.map(m => m.id))
    .in('invite_status', ['invited', 'accepted'])
    .is('joined_at', null);

  return { closed: stale.length };
}

/** Small helper so routes stop repeating this shape. */
export function withDerived(m) {
  return { ...m, state: effectiveStatus(m), ends_at: endsAt(m)?.toISOString() || null };
}
