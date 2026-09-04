import { requireMember } from '@/lib/membership/auth';
import { ok, fail, readJson } from '@/lib/api';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { joinability, roleInMeeting, isHostLike } from '@/lib/meetings';
import { loadMeetingFor } from '@/lib/meetingsServer';
import { livekitConfig, mintToken, grantsFor } from '@/lib/livekit';
import { notifyMeeting } from '@/lib/meetingsServer';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/* THE DOOR.
 *
 * Everything that decides whether a person gets into a meeting happens here,
 * on the server, in this order:
 *
 *   1. Are they a signed-in TNR member?              requireMember
 *   2. Does this meeting exist?                      loadMeetingFor
 *   3. What is their standing in it?                 roleInMeeting — read from
 *                                                    the DB, never from the body
 *   4. Do the meeting's own rules let them in now?   joinability — the SAME
 *                                                    function the Join button
 *                                                    calls, so the button and
 *                                                    the door cannot disagree
 *   5. Has the host admitted them?                   waiting room
 *   6. Only then is a token minted, with permissions derived from (3) and the
 *      meeting's settings.
 *
 * The request body carries a meeting id and nothing else that matters. A
 * client cannot ask for a role, a room name, or a permission — if it could,
 * every one of the checks above would be decoration.
 */
export async function POST(req) {
  const { member, res } = await requireMember(req); if (res) return res;
  const b = await readJson(req);
  const id = String(b.meeting_id || '').trim();
  const sb = supabaseAdmin();

  const { meeting, participation } = await loadMeetingFor(id, member.id);
  const role = meeting ? roleInMeeting(meeting, member.id, participation) : null;

  // Not found rather than forbidden — see the member meetings route.
  if (!meeting || !role) return fail('NOT_FOUND', 404, { message: 'Meeting not found.' });

  const host = isHostLike(role);

  /* A host pressing Start is what makes a meeting live.
   *
   * Done here rather than in a separate endpoint so the transition happens at
   * the exact moment the host actually enters. A "start" button that flips the
   * status and then fails to connect tells 30 people a meeting is running when
   * nobody is in the room. */
  let current = meeting;
  if (host && meeting.status === 'scheduled') {
    const gate = joinability(meeting, { participation, isHost: true });
    if (!gate.can) return fail('TOO_EARLY', 409, { message: gate.reason });

    const { data: started } = await sb.from('meetings')
      .update({ status: 'live', started_at: new Date().toISOString() })
      .eq('id', id).eq('status', 'scheduled')     // only if still scheduled — two
      .select('*').maybeSingle();                 // co-hosts arriving together
    if (started) {                                // must not race each other
      current = started;
      await notifyMeeting(started, 'started', { actorId: member.id });
    } else {
      const { data: fresh } = await sb.from('meetings').select('*').eq('id', id).maybeSingle();
      current = fresh || meeting;
    }
  }

  // ── The rules ──
  const gate = joinability(current, {
    participation, isHost: role === 'host', isCoHost: role === 'co_host',
  });
  if (!gate.can) return fail('NOT_JOINABLE', 409, { message: gate.reason });

  // ── Passcode, if the meeting has one ──
  if (current.password_hash && !host) {
    const bcrypt = (await import('bcryptjs')).default;
    const given = String(b.password || '');
    if (!given) return fail('PASSWORD_REQUIRED', 401, { message: 'This meeting needs a passcode.' });
    if (!(await bcrypt.compare(given, current.password_hash)))
      return fail('PASSWORD_WRONG', 401, { message: 'That passcode is not correct.' });
  }

  // ── Waiting room ──
  /* Hosts are never held. Someone removed by the host is refused outright
   * rather than put back in the queue — otherwise "remove" would mean "ask
   * again", and a host dealing with a disruptive participant would be stuck
   * re-rejecting them. */
  if (participation?.admission === 'removed' || participation?.admission === 'rejected')
    return fail('REMOVED', 403, { message: 'The host has removed you from this meeting.' });

  if (!host && current.waiting_room_enabled) {
    if (participation?.admission !== 'admitted') {
      if (participation?.admission !== 'pending') {
        await sb.from('meeting_participants')
          .update({ admission: 'pending', admission_at: new Date().toISOString() })
          .eq('meeting_id', id).eq('member_id', member.id);
      }
      return ok({ waiting: true, message: 'Your request has been sent to the host.' });
    }
  }

  // ── Video provider ──
  const cfg = livekitConfig();
  if (!cfg.configured) {
    /* Honest failure, not a broken room.
     *
     * Everything above this line worked: the member is authorised, the meeting
     * is live, attendance would be recorded. Only the video provider is
     * missing, so that is exactly what the message says — an administrator can
     * act on it, whereas a spinner that never resolves tells nobody anything. */
    return fail('VIDEO_NOT_CONFIGURED', 503, {
      message: 'Video is not set up yet. An administrator needs to add the LiveKit credentials.',
      authorised: true,
    });
  }

  const { canPublish, canShareScreen } = grantsFor({ role, meeting: current });
  let token;
  try {
    token = await mintToken({
      room: current.room_id,
      identity: member.id,
      name: member.full_name || member.membership_id,
      canPublish, canShareScreen,
      // Read by every other participant in the room. Membership ID and role
      // only — never contact details.
      metadata: { membership_id: member.membership_id, role, photo_url: member.photo_url || null },
    });
  } catch {
    return fail('TOKEN_FAILED', 500, { message: 'Could not create a meeting token.' });
  }

  // ── Attendance: open a session ──
  /* A row per CONNECTION. Someone on mobile data will do this several times in
   * an hour, and summing the sessions is the only way the report reflects the
   * time they were actually present. See migration_meetings.sql. */
  await sb.from('meeting_attendance_sessions')
    .insert({ meeting_id: id, member_id: member.id });

  await sb.from('meeting_participants').update({
    invite_status: 'joined',
    joined_at: participation?.joined_at || new Date().toISOString(),
  }).eq('meeting_id', id).eq('member_id', member.id);

  return ok({
    token, url: cfg.url, room: current.room_id,
    role, is_host: host,
    /* Host-LIKE (can admit, mute, eject) and host-EXACTLY (can also end the
     * meeting for everyone) are different permissions, so the room is told
     * both. Collapsing them put an "End for all" button in front of every
     * co-host — which, once interview panellists became co-hosts, was six
     * people who could clear a room of thirty candidates by mistake. */
    is_owner: role === 'host',
    meeting: {
      id: current.id, title: current.title, chat_enabled: current.chat_enabled,
      recording_enabled: current.recording_enabled,
      screen_share_enabled: current.screen_share_enabled,
      waiting_room_enabled: current.waiting_room_enabled,
    },
    me: { id: member.id, name: member.full_name, membership_id: member.membership_id },
  });
}
