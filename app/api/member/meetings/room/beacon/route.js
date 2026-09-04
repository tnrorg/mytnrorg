import { verifyMemberToken } from '@/lib/membership/auth';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { ok, fail, readJson } from '@/lib/api';
import { meetingRunSeconds, attendanceStatusFor, mergedAttendanceSeconds } from '@/lib/meetings';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/* "The tab is closing" — closes the attendance session.
 *
 * WHY THIS EXISTS SEPARATELY FROM /room: navigator.sendBeacon is the only
 * request the browser reliably delivers while a page is being destroyed, and
 * it cannot set an Authorization header. A normal fetch on pagehide is
 * cancelled, which is precisely when attendance needs recording — people close
 * the tab, they do not press Leave.
 *
 * So the session token travels in the body instead. It is verified exactly as
 * requireMember verifies it, with the same secret and the same expiry rules;
 * the only thing that changes is where it was read from. This endpoint can do
 * one thing — close the caller's OWN open session on one meeting — so a stolen
 * beacon body cannot be used to reach anything else.
 */
export async function POST(req) {
  const b = await readJson(req);

  const claim = b?.token ? verifyMemberToken(String(b.token)) : null;
  if (!claim?.sub) return fail('UNAUTHORIZED', 401, { message: 'Invalid session.' });

  const meetingId = String(b.meeting_id || '').trim();
  if (!meetingId) return fail('INVALID', 400, { message: 'Missing meeting.' });

  const sb = supabaseAdmin();

  // Only ever the caller's own most recent OPEN session, on this meeting.
  const { data: open } = await sb.from('meeting_attendance_sessions')
    .select('id').eq('meeting_id', meetingId).eq('member_id', claim.sub)
    .is('left_at', null).order('joined_at', { ascending: false }).limit(1).maybeSingle();
  if (!open) return ok({ closed: false });

  const now = new Date().toISOString();
  await sb.from('meeting_attendance_sessions')
    .update({ left_at: now, disconnect_reason: String(b.reason || 'closed').slice(0, 40) })
    .eq('id', open.id);

  await sb.from('meeting_participants').update({ left_at: now })
    .eq('meeting_id', meetingId).eq('member_id', claim.sub);

  /* Roll up now rather than waiting for the host to end the meeting.
   *
   * A member who closes the tab and looks at their own attendance an hour
   * later should see the truth, not a blank row waiting on someone else's
   * action. Recomputed from the sessions, so a second beacon — browsers do
   * sometimes fire pagehide twice — cannot double anyone's total. */
  const { data: meeting } = await sb.from('meetings')
    .select('id, duration_minutes, scheduled_at, started_at, ended_at')
    .eq('id', meetingId).maybeSingle();
  if (meeting) {
    const { data: sessions } = await sb.from('meeting_attendance_sessions')
      .select('joined_at, left_at, duration_seconds')
      .eq('meeting_id', meetingId).eq('member_id', claim.sub).order('joined_at');

    const rows = sessions || [];
    const closed = rows.filter(s => s.left_at);

    /* The SAME union calculation as the other two roll-up paths.
     *
     * This one was missed when the overlap bug was fixed, and it is the one
     * that runs when a member simply closes the tab — so it would have written
     * the old double-counted total straight back over the corrected figure,
     * and the bug would have looked fixed until somebody left a meeting. */
    const total = mergedAttendanceSeconds(rows, {
      start: meeting.started_at, end: meeting.ended_at,
    });
    const { status, percentage } = attendanceStatusFor({
      totalSeconds: total,
      runSeconds: meetingRunSeconds(meeting),
      firstJoinedAt: rows[0]?.joined_at,
      startedAt: meeting.started_at,
      scheduledAt: meeting.scheduled_at,
    });

    await sb.from('meeting_attendance').upsert({
      meeting_id: meetingId, member_id: claim.sub,
      first_joined_at: rows[0]?.joined_at || null,
      last_left_at: closed.length ? closed[closed.length - 1].left_at : null,
      total_duration_seconds: total,
      session_count: rows.length,
      attendance_percentage: percentage,
      attendance_status: status,
      updated_at: now,
    }, { onConflict: 'meeting_id,member_id' });
  }

  return ok({ closed: true });
}
