import { requireMember } from '@/lib/membership/auth';
import { ok, fail, readJson } from '@/lib/api';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { roleInMeeting, isHostLike, meetingRunSeconds, attendanceStatusFor } from '@/lib/meetings';
import { loadMeetingFor, notifyMeeting, MEMBER_FIELDS } from '@/lib/meetingsServer';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/* In-room operations: leaving, the waiting room, and ending the meeting.
 *
 * Every action re-derives the caller's standing from the database. Being in
 * the room is not authority to do anything — a participant who guesses the
 * shape of an "admit" request is still a participant.
 */

// ── Host: who is waiting ──
export async function GET(req) {
  const { member, res } = await requireMember(req); if (res) return res;
  const id = String(new URL(req.url).searchParams.get('meeting_id') || '').trim();

  const { meeting, participation } = await loadMeetingFor(id, member.id);
  const role = meeting ? roleInMeeting(meeting, member.id, participation) : null;
  if (!meeting || !role) return fail('NOT_FOUND', 404, { message: 'Meeting not found.' });

  // A participant asking who is in the lobby gets their OWN status and nothing
  // else. The queue is a list of members, and that is the host's to see.
  if (!isHostLike(role))
    return ok({ waiting: [], my_admission: participation?.admission || 'admitted' });

  const sb = supabaseAdmin();
  const { data: rows } = await sb.from('meeting_participants')
    .select('id, member_id, admission, admission_at')
    .eq('meeting_id', id).eq('admission', 'pending').order('admission_at');

  let people = [];
  if (rows?.length) {
    const { data: mem } = await sb.from('membership_members')
      .select(MEMBER_FIELDS).in('id', rows.map(r => r.member_id));
    const by = Object.fromEntries((mem || []).map(m => [m.id, m]));
    people = rows.map(r => ({ ...r, member: by[r.member_id] || null }));
  }
  return ok({ waiting: people, my_admission: 'admitted', status: meeting.status });
}

export async function POST(req) {
  const { member, res } = await requireMember(req); if (res) return res;
  const b = await readJson(req);
  const id = String(b.meeting_id || '').trim();
  const sb = supabaseAdmin();

  const { meeting, participation } = await loadMeetingFor(id, member.id);
  const role = meeting ? roleInMeeting(meeting, member.id, participation) : null;
  if (!meeting || !role) return fail('NOT_FOUND', 404, { message: 'Meeting not found.' });
  const host = isHostLike(role);

  // ── Anyone: I am leaving ──
  /* Closes the OPEN session only. A member who has connected three times has
   * three rows; closing them all would credit them for time they were not
   * connected, which is the whole failure the session table exists to avoid. */
  if (b.action === 'leave') {
    const { data: open } = await sb.from('meeting_attendance_sessions')
      .select('id').eq('meeting_id', id).eq('member_id', member.id)
      .is('left_at', null).order('joined_at', { ascending: false }).limit(1).maybeSingle();

    if (open) {
      await sb.from('meeting_attendance_sessions')
        .update({ left_at: new Date().toISOString(), disconnect_reason: String(b.reason || 'left').slice(0, 40) })
        .eq('id', open.id);
    }
    await sb.from('meeting_participants')
      .update({ left_at: new Date().toISOString() })
      .eq('meeting_id', id).eq('member_id', member.id);

    await rollUpAttendance(sb, meeting, member.id);
    return ok({ message: 'Left the meeting.' });
  }

  // ── Everything below is host-only ──
  if (!host) return fail('FORBIDDEN', 403, { message: 'Only the host can do that.' });

  if (b.action === 'admit' || b.action === 'reject' || b.action === 'remove') {
    const targets = Array.isArray(b.member_ids) ? b.member_ids.map(String)
      : b.member_id ? [String(b.member_id)] : [];
    if (!targets.length) return fail('INVALID', 400, { message: 'Nobody selected.' });

    // The host cannot eject themselves and leave a meeting nobody can end.
    const safe = targets.filter(t => t !== String(meeting.host_id));
    if (!safe.length) return fail('INVALID', 400, { message: 'The host cannot be removed.' });

    const admission = b.action === 'admit' ? 'admitted'
      : b.action === 'reject' ? 'rejected' : 'removed';

    await sb.from('meeting_participants').update({
      admission, admission_at: new Date().toISOString(), admitted_by: member.id,
    }).eq('meeting_id', id).in('member_id', safe);

    /* Removing someone also closes their attendance session. They were in the
     * room until this moment and the record should say so — leaving the
     * session open would keep counting time after they were disconnected. */
    if (admission === 'removed') {
      const { data: open } = await sb.from('meeting_attendance_sessions')
        .select('id, member_id').eq('meeting_id', id).in('member_id', safe).is('left_at', null);
      for (const s of (open || [])) {
        await sb.from('meeting_attendance_sessions')
          .update({ left_at: new Date().toISOString(), disconnect_reason: 'removed_by_host' })
          .eq('id', s.id);
        await rollUpAttendance(sb, meeting, s.member_id);
      }
    }

    return ok({ message: `${safe.length} ${admission}.`, count: safe.length });
  }

  if (b.action === 'lock') {
    await sb.from('meetings').update({ locked: !!b.locked }).eq('id', id);
    return ok({ message: b.locked ? 'Meeting locked.' : 'Meeting unlocked.' });
  }

  // ── End for everyone ──
  if (b.action === 'end') {
    const now = new Date().toISOString();
    const { data: ended } = await sb.from('meetings')
      .update({ status: 'completed', ended_at: now }).eq('id', id).select('*').single();

    /* Close every session still open, THEN roll up.
     *
     * People do not press Leave — they close the tab, or their phone dies. If
     * the sessions were left open, everyone still connected when the host
     * ended would show a null duration and be recorded absent, which is the
     * opposite of the truth: they stayed to the end. */
    const { data: open } = await sb.from('meeting_attendance_sessions')
      .select('id, member_id').eq('meeting_id', id).is('left_at', null);
    if (open?.length) {
      await sb.from('meeting_attendance_sessions')
        .update({ left_at: now, disconnect_reason: 'meeting_ended' })
        .in('id', open.map(s => s.id));
    }

    const { data: everyone } = await sb.from('meeting_attendance_sessions')
      .select('member_id').eq('meeting_id', id);
    for (const mid of [...new Set((everyone || []).map(s => s.member_id))]) {
      await rollUpAttendance(sb, ended, mid);
    }

    // Anyone who never connected is marked missed.
    await sb.from('meeting_participants').update({ invite_status: 'missed' })
      .eq('meeting_id', id).is('joined_at', null).in('invite_status', ['invited', 'accepted']);

    await notifyMeeting(ended, 'completed', { actorId: member.id });
    return ok({ message: 'Meeting ended for everyone.' });
  }

  return fail('INVALID', 400, { message: 'Unknown action.' });
}

/* Sum a member's sessions into the attendance row.
 *
 * Recomputed from the sessions every time rather than incremented, so a
 * duplicate call, a retry, or a session closed twice cannot inflate anyone's
 * total. The sessions are the truth; this table is a cache of them.
 */
async function rollUpAttendance(sb, meeting, memberId) {
  const { data: sessions } = await sb.from('meeting_attendance_sessions')
    .select('joined_at, left_at, duration_seconds')
    .eq('meeting_id', meeting.id).eq('member_id', memberId).order('joined_at');

  const rows = sessions || [];
  const closed = rows.filter(s => s.left_at);
  const total = closed.reduce((n, s) => n + (s.duration_seconds || 0), 0);

  const { status, percentage } = attendanceStatusFor({
    totalSeconds: total,
    runSeconds: meetingRunSeconds(meeting),
    firstJoinedAt: rows[0]?.joined_at,
    startedAt: meeting.started_at,
  });

  await sb.from('meeting_attendance').upsert({
    meeting_id: meeting.id,
    member_id: memberId,
    first_joined_at: rows[0]?.joined_at || null,
    last_left_at: closed.length ? closed[closed.length - 1].left_at : null,
    total_duration_seconds: total,
    session_count: rows.length,
    attendance_percentage: percentage,
    attendance_status: status,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'meeting_id,member_id' });
}
