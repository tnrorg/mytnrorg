import { supabaseAdmin, signedRecordingUrl } from '@/lib/supabaseServer';
import { requireAdmin } from '@/lib/guard';
import { uploadDataUrl } from '@/lib/storage';
import { logAudit, clientIp } from '@/lib/audit';
import { ok, fail, readJson } from '@/lib/api';
import { meetingRunSeconds, attendanceStatusFor, ATTENDANCE_STATUS, mergedAttendanceSeconds } from '@/lib/meetings';
import { hostsOf, participantsOf, withDerived, MEMBER_FIELDS } from '@/lib/meetingsServer';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const HINT = 'Administrator: run supabase/migration_meetings.sql.';

/* THE MEETING RECORD — everything a meeting leaves behind.
 *
 * One route rather than five, because the record page reads all of it at once
 * and five round trips to draw one screen is five chances for a partial load.
 * Writes are separated by a named action, never by a free-form patch.
 *
 * Reached under the `meetings` permission area. Attendance says who did and
 * did not turn up, and minutes carry what a committee resolved — this is the
 * most sensitive corner of the module, and it is deliberately not readable by
 * an admin who only holds Website Content.
 */

export async function GET(req) {
  const { res } = await requireAdmin(req); if (res) return res;
  const id = String(new URL(req.url).searchParams.get('id') || '').trim();
  if (!id) return fail('INVALID', 400, { message: 'Missing meeting.' });

  const sb = supabaseAdmin();
  const { data: meeting } = await sb.from('meetings').select('*').eq('id', id).maybeSingle();
  if (!meeting) return fail('NOT_FOUND', 404, { message: 'Meeting not found.' });

  const [
    { host, coHosts }, participants,
    { data: attendance }, { data: sessions }, { data: minutes },
    { data: actions }, { data: documents }, { data: recordings }, { data: chat },
  ] = await Promise.all([
    hostsOf(meeting),
    participantsOf(id),
    sb.from('meeting_attendance').select('*').eq('meeting_id', id),
    sb.from('meeting_attendance_sessions').select('*').eq('meeting_id', id).order('joined_at'),
    sb.from('meeting_minutes').select('*').eq('meeting_id', id).maybeSingle(),
    sb.from('meeting_action_items').select('*').eq('meeting_id', id).order('created_at'),
    sb.from('meeting_documents').select('*').eq('meeting_id', id).order('created_at', { ascending: false }),
    sb.from('meeting_recordings').select('*').eq('meeting_id', id).order('created_at', { ascending: false }),
    sb.from('meeting_chat').select('*').eq('meeting_id', id).is('deleted_at', null).order('created_at'),
  ]);

  /* Attach the person to every row here rather than in five separate queries.
   * Everyone who appears anywhere in this record — invited, attended, assigned
   * an action, uploaded a document, said something — resolved once. */
  const ids = new Set([
    ...participants.map(p => p.member_id),
    ...(attendance || []).map(a => a.member_id),
    ...(actions || []).map(a => a.assigned_to).filter(Boolean),
    ...(documents || []).map(d => d.uploaded_by).filter(Boolean),
    ...(chat || []).map(c => c.sender_id).filter(Boolean),
  ]);
  let people = {};
  if (ids.size) {
    const { data: mem } = await sb.from('membership_members').select(MEMBER_FIELDS).in('id', [...ids]);
    people = Object.fromEntries((mem || []).map(m => [m.id, m]));
  }

  /* Sessions grouped per member, so the report can show WHY someone has 16
   * minutes: three drops on mobile data reads very differently from arriving
   * an hour late, and the roll-up alone cannot tell them apart. */
  const byMember = {};
  for (const s of (sessions || [])) (byMember[s.member_id] ||= []).push(s);

  const run = meetingRunSeconds(meeting);
  const rows = participants.map(p => {
    const a = (attendance || []).find(x => x.member_id === p.member_id);
    return {
      member_id: p.member_id,
      member: people[p.member_id] || null,
      role: p.role,
      invite_status: p.invite_status,
      first_joined_at: a?.first_joined_at || null,
      last_left_at: a?.last_left_at || null,
      total_duration_seconds: a?.total_duration_seconds || 0,
      session_count: a?.session_count || 0,
      attendance_percentage: a ? Number(a.attendance_percentage) : 0,
      attendance_status: a?.attendance_status || 'absent',
      sessions: byMember[p.member_id] || [],
    };
  });

  const summary = { invited: rows.length, run_seconds: run };
  for (const s of ATTENDANCE_STATUS) summary[s] = rows.filter(r => r.attendance_status === s).length;
  summary.attended = rows.filter(r => r.total_duration_seconds > 0).length;
  summary.average_percentage = rows.length
    ? Math.round((rows.reduce((n, r) => n + r.attendance_percentage, 0) / rows.length) * 10) / 10
    : 0;

  return ok({
    meeting: withDerived(meeting), host, coHosts,
    attendance: rows, summary,
    minutes: minutes || null,
    actions: (actions || []).map(a => ({ ...a, assignee: people[a.assigned_to] || null })),
    documents: (documents || []).map(d => ({ ...d, uploader: people[d.uploaded_by] || null })),
    /* Signed at the moment of reading.
     *
     * The stored file_url points into a PRIVATE bucket and would 403 in a
     * <video> tag. Signing here means the link in the page works for an hour
     * and then stops, rather than a permanent URL to a committee session
     * living in whoever's browser history. */
    recordings: await Promise.all((recordings || []).map(async r => ({
      ...r,
      file_url: r.file_url ? await signedRecordingUrl(r.file_url) : null,
    }))),
    chat: (chat || []).map(c => ({ ...c, sender: people[c.sender_id] || null })),
    hint: HINT,
  });
}

export async function POST(req) {
  const { admin, res } = await requireAdmin(req); if (res) return res;
  const b = await readJson(req);
  const sb = supabaseAdmin();

  const id = String(b.meeting_id || '').trim();
  if (!id) return fail('INVALID', 400, { message: 'Missing meeting.' });

  const { data: meeting } = await sb.from('meetings').select('id, title').eq('id', id).maybeSingle();
  if (!meeting) return fail('NOT_FOUND', 404, { message: 'Meeting not found.' });

  // ── Minutes ──
  if (b.action === 'save_minutes') {
    const patch = {
      meeting_id: id,
      summary: txt(b.summary),
      key_discussion: txt(b.key_discussion),
      decisions: txt(b.decisions),
      status: b.status === 'published' ? 'published' : 'draft',
      updated_at: new Date().toISOString(),
    };
    /* published_at is stamped the first time, never re-stamped by a later
     * edit. "Adopted on the 5th" is a fact about the committee's decision, not
     * about when somebody last fixed a typo in it. */
    if (patch.status === 'published') {
      const { data: prev } = await sb.from('meeting_minutes')
        .select('published_at').eq('meeting_id', id).maybeSingle();
      patch.published_at = prev?.published_at || new Date().toISOString();
    }

    const { data, error } = await sb.from('meeting_minutes')
      .upsert(patch, { onConflict: 'meeting_id' }).select('*').single();
    if (error) return fail('SAVE_FAILED', 500, { message: 'Could not save the minutes.', detail: error.message, hint: HINT });

    await logAudit({
      action: patch.status === 'published' ? 'MEETING_MINUTES_PUBLISHED' : 'MEETING_MINUTES_SAVED',
      actor: admin?.username || 'admin', details: meeting.title?.slice(0, 200), ip: clientIp(req),
    });
    return ok({ minutes: data, message: patch.status === 'published' ? 'Minutes published.' : 'Draft saved.' });
  }

  // ── Action items ──
  if (b.action === 'save_action') {
    const title = String(b.title || '').trim();
    if (!title) return fail('INVALID', 400, { errors: { title: 'Describe the task.' } });

    const patch = {
      meeting_id: id,
      title: title.slice(0, 200),
      description: txt(b.description),
      assigned_to: b.assigned_to || null,
      deadline: b.deadline || null,
      status: ['pending', 'in_progress', 'completed'].includes(b.status) ? b.status : 'pending',
      updated_at: new Date().toISOString(),
    };
    // Stamped when it first reaches completed, cleared if it is reopened.
    patch.completed_at = patch.status === 'completed' ? new Date().toISOString() : null;

    const q = b.id
      ? sb.from('meeting_action_items').update(patch).eq('id', b.id)
      : sb.from('meeting_action_items').insert(patch);
    const { data, error } = await q.select('*').single();
    if (error) return fail('SAVE_FAILED', 500, { message: 'Could not save.', detail: error.message });
    return ok({ item: data, message: b.id ? 'Action item updated.' : 'Action item added.' });
  }

  if (b.action === 'delete_action') {
    if (!b.id) return fail('INVALID', 400, { message: 'Missing item.' });
    await sb.from('meeting_action_items').delete().eq('id', b.id).eq('meeting_id', id);
    return ok({ message: 'Action item removed.' });
  }

  // ── Documents ──
  if (b.action === 'add_document') {
    const title = String(b.title || '').trim();
    if (!title) return fail('INVALID', 400, { errors: { title: 'Give the file a name.' } });
    if (!b.file_data) return fail('INVALID', 400, { errors: { file: 'Choose a file.' } });

    /* Size checked BEFORE the upload, from the base64 length.
     * A 30 MB presentation posted to a serverless function fails somewhere in
     * the platform with an opaque 413; catching it here means the admin is
     * told what happened and what to do instead. */
    const bytes = String(b.file_data).length * 0.75;
    if (bytes > 15 * 1024 * 1024)
      return fail('TOO_BIG', 400, { message: 'Files must be under 15 MB. Share larger files by link.' });

    let url;
    try { url = await uploadDataUrl(b.file_data, 'meetings'); }
    catch { return fail('UPLOAD_FAILED', 502, { message: 'Could not upload the file.' }); }
    if (!url) return fail('UPLOAD_FAILED', 502, { message: 'Could not upload the file.' });

    const { data, error } = await sb.from('meeting_documents').insert({
      meeting_id: id,
      title: title.slice(0, 160),
      file_url: url,
      file_type: String(b.file_type || '').slice(0, 100) || null,
      file_size: Math.round(bytes),
      category: ['agenda', 'presentation', 'minutes', 'report', 'attachment'].includes(b.category)
        ? b.category : 'attachment',
      uploaded_by: b.uploaded_by || null,
    }).select('*').single();
    if (error) return fail('SAVE_FAILED', 500, { message: 'Uploaded, but could not be recorded.', detail: error.message });

    await logAudit({
      action: 'MEETING_DOCUMENT_ADDED', actor: admin?.username || 'admin',
      details: `${meeting.title}: ${title}`.slice(0, 200), ip: clientIp(req),
    });
    return ok({ document: data, message: 'Document added.' });
  }

  if (b.action === 'delete_document') {
    if (!b.id) return fail('INVALID', 400, { message: 'Missing document.' });
    await sb.from('meeting_documents').delete().eq('id', b.id).eq('meeting_id', id);
    await logAudit({
      action: 'MEETING_DOCUMENT_DELETED', actor: admin?.username || 'admin',
      details: meeting.title?.slice(0, 200), ip: clientIp(req),
    });
    return ok({ message: 'Document removed.' });
  }

  /* ── Recompute attendance ──
   *
   * The sessions are the truth; meeting_attendance is a cache of them. If a
   * browser died without firing pagehide, or the host ended the meeting while
   * a network was down, a row can be stale. This rebuilds every row from the
   * sessions, so the committee is never stuck looking at a number they can see
   * is wrong with no way to correct it. */
  if (b.action === 'recompute_attendance') {
    const { data: full } = await sb.from('meetings').select('*').eq('id', id).maybeSingle();
    const { data: sessions } = await sb.from('meeting_attendance_sessions')
      .select('member_id, joined_at, left_at, duration_seconds').eq('meeting_id', id).order('joined_at');

    const run = meetingRunSeconds(full);
    const byMember = {};
    for (const s of (sessions || [])) (byMember[s.member_id] ||= []).push(s);

    let n = 0;
    for (const [memberId, list] of Object.entries(byMember)) {
      const closed = list.filter(s => s.left_at);
      // Same union calculation as the live roll-up — one rule, in one place.
      const total = mergedAttendanceSeconds(list, {
        start: full?.started_at, end: full?.ended_at,
      });
      const { status, percentage } = attendanceStatusFor({
        totalSeconds: total, runSeconds: run,
        firstJoinedAt: list[0]?.joined_at, startedAt: full?.started_at,
        scheduledAt: full?.scheduled_at,
      });
      await sb.from('meeting_attendance').upsert({
        meeting_id: id, member_id: memberId,
        first_joined_at: list[0]?.joined_at || null,
        last_left_at: closed.length ? closed[closed.length - 1].left_at : null,
        total_duration_seconds: total,
        session_count: list.length,
        attendance_percentage: percentage,
        attendance_status: status,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'meeting_id,member_id' });
      n += 1;
    }
    return ok({ count: n, message: `Attendance recalculated for ${n} member(s).` });
  }

  return fail('INVALID', 400, { message: 'Unknown action.' });
}

const txt = (v) => { const s = String(v ?? '').trim(); return s || null; };
