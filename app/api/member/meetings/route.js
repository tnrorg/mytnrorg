import { requireMember } from '@/lib/membership/auth';
import { ok, fail, readJson } from '@/lib/api';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { tabFor, joinability, roleInMeeting, isHostLike } from '@/lib/meetings';
import {
  loadMeetingFor, hostsOf, participantsOf, sweepLifecycle, sendMeetingReminders, withDerived, MEMBER_FIELDS,
} from '@/lib/meetingsServer';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/* A member's own meetings.
 *
 * THE ACCESS RULE, stated once: a member may read a meeting only if there is a
 * row for them in meeting_participants, or they are its host or co-host.
 *
 * This is checked on the SERVER for every read, including the single-meeting
 * read, because meeting ids appear in URLs. Section 22 of the brief asks that
 * a member not reach a private meeting by editing the id in the address bar —
 * and since this app talks to Postgres with the service-role key, RLS is never
 * evaluated and cannot be what stops them. This function is what stops them.
 */

export async function GET(req) {
  const { member, res } = await requireMember(req); if (res) return res;
  const p = new URL(req.url).searchParams;
  const one = (p.get('id') || '').trim();
  const sb = supabaseAdmin();

  await sweepLifecycle().catch(() => {});
  // Opportunistic, because this project has no scheduler. See
  // sendMeetingReminders() for the honest limitation that comes with that.
  await sendMeetingReminders().catch(() => {});

  // ── One meeting ──
  if (one) {
    const { meeting, participation } = await loadMeetingFor(one, member.id);

    /* A meeting they are not on is reported as NOT FOUND, not as "forbidden".
     *
     * "You are not allowed to see this" confirms the meeting exists, which
     * tells someone probing ids exactly which ones are real. */
    const myRole = meeting ? roleInMeeting(meeting, member.id, participation) : null;
    if (!meeting || !myRole)
      return fail('NOT_FOUND', 404, { message: 'Meeting not found.' });

    const [{ host, coHosts }, everyone] = await Promise.all([
      hostsOf(meeting),
      // The full list is for hosts. A general participant is shown the count,
      // not a roster of who else was invited — an invitation list is itself
      // information about other members.
      isHostLike(myRole) ? participantsOf(meeting.id) : participantsOf(meeting.id, { withMembers: false }),
    ]);

    const join = joinability(meeting, {
      participation, isHost: myRole === 'host', isCoHost: myRole === 'co_host',
    });

    return ok({
      meeting: publicMeeting(meeting),
      host, coHosts,
      my_role: myRole,
      my_participation: participation
        ? { invite_status: participation.invite_status, joined_at: participation.joined_at }
        : null,
      participant_count: everyone.length,
      participants: isHostLike(myRole) ? everyone : undefined,
      join,
      tab: tabFor(meeting, participation),
    });
  }

  // ── My list ──
  const { data: mine } = await sb.from('meeting_participants')
    .select('*').eq('member_id', member.id);
  const rows = mine || [];

  // Meetings they host but somehow have no participant row for — belt and
  // braces, so a host can never lose sight of their own meeting.
  const { data: hosted } = await sb.from('meetings')
    .select('id').eq('host_id', member.id).limit(200);

  const ids = [...new Set([...rows.map(r => r.meeting_id), ...(hosted || []).map(h => h.id)])];
  if (!ids.length) return ok({ meetings: [], counts: emptyCounts() });

  const { data: ms } = await sb.from('meetings').select('*')
    .in('id', ids).order('scheduled_at', { ascending: false });

  const byMeeting = Object.fromEntries(rows.map(r => [r.meeting_id, r]));
  const { data: hs } = await sb.from('membership_members').select(MEMBER_FIELDS)
    .in('id', [...new Set((ms || []).map(m => m.host_id).filter(Boolean))]);
  const hosts = Object.fromEntries((hs || []).map(h => [h.id, h]));

  const counts = emptyCounts();
  const meetings = (ms || []).map(m => {
    const participation = byMeeting[m.id] || null;
    const tab = tabFor(m, participation);
    counts[tab] = (counts[tab] || 0) + 1;
    return {
      ...publicMeeting(m),
      tab,
      host: hosts[m.host_id] || null,
      my_role: roleInMeeting(m, member.id, participation),
      my_invite_status: participation?.invite_status || null,
    };
  });

  return ok({ meetings, counts });
}

/** Accept or decline an invitation. */
export async function POST(req) {
  const { member, res } = await requireMember(req); if (res) return res;
  const b = await readJson(req);
  const id = String(b.meeting_id || '').trim();
  const reply = String(b.reply || '').trim();

  if (!['accepted', 'declined'].includes(reply))
    return fail('INVALID', 400, { message: 'Reply must be accept or decline.' });

  const { meeting, participation } = await loadMeetingFor(id, member.id);
  if (!meeting || !participation)
    return fail('NOT_FOUND', 404, { message: 'Meeting not found.' });

  // Someone who already attended cannot retroactively decline. The record of
  // who was in the room is not editable from the member portal.
  if (participation.joined_at)
    return ok({ unchanged: true, message: 'You have already attended this meeting.' });

  await supabaseAdmin().from('meeting_participants')
    .update({ invite_status: reply })
    .eq('meeting_id', id).eq('member_id', member.id);

  return ok({ message: reply === 'accepted' ? 'Marked as attending.' : 'Marked as not attending.' });
}

/* What a member is allowed to see about a meeting.
 *
 * password_hash never leaves the server — not even as a boolean by accident —
 * so it is stripped by naming the fields that DO go out rather than by
 * deleting the ones that must not. A field added to the table later is then
 * private until somebody deliberately publishes it, which is the safer
 * direction for that mistake to fail in.
 */
function publicMeeting(m) {
  const d = withDerived(m);
  return {
    id: d.id, title: d.title, description: d.description, agenda: d.agenda,
    meeting_type: d.meeting_type, scheduled_at: d.scheduled_at, ends_at: d.ends_at,
    duration_minutes: d.duration_minutes, status: d.status, state: d.state,
    started_at: d.started_at, ended_at: d.ended_at,
    waiting_room_enabled: d.waiting_room_enabled,
    recording_enabled: d.recording_enabled,
    chat_enabled: d.chat_enabled,
    screen_share_enabled: d.screen_share_enabled,
    join_before_host: d.join_before_host,
    locked: d.locked,
    has_password: !!d.password_hash,
    cancelled_reason: d.cancelled_reason,
    host_id: d.host_id, co_host_ids: d.co_host_ids,
  };
}

const emptyCounts = () => ({ upcoming: 0, live: 0, completed: 0, missed: 0, cancelled: 0 });
