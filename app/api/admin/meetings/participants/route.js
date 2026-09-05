import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAdmin } from '@/lib/guard';
import { logAudit, clientIp } from '@/lib/audit';
import { ok, fail, readJson } from '@/lib/api';
import { PARTICIPANT_ROLES } from '@/lib/meetings';
import { participantsOf, resolveAudience, inviteMembers, notifyMeeting } from '@/lib/meetingsServer';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/* Adding to and removing from a meeting's invitation list, after it exists.
 *
 * Separate from the meeting route because inviting twenty more people is a
 * different action from editing the agenda, and folding them together would
 * mean every agenda edit re-ran the invitation logic.
 */

export async function GET(req) {
  const { res } = await requireAdmin(req); if (res) return res;
  const id = String(new URL(req.url).searchParams.get('meeting_id') || '').trim();
  if (!id) return fail('INVALID', 400, { message: 'Missing meeting.' });
  return ok({ participants: await participantsOf(id) });
}

export async function POST(req) {
  const { admin, res } = await requireAdmin(req); if (res) return res;
  const b = await readJson(req);
  const sb = supabaseAdmin();

  const meetingId = String(b.meeting_id || '').trim();
  if (!meetingId) return fail('INVALID', 400, { message: 'Missing meeting.' });

  const { data: meeting } = await sb.from('meetings').select('*').eq('id', meetingId).maybeSingle();
  if (!meeting) return fail('NOT_FOUND', 404, { message: 'Meeting not found.' });

  // ── Invite more people ──
  if (b.action === 'add') {
    const people = await resolveAudience(
      Array.isArray(b.audience) ? b.audience : [],
      Array.isArray(b.member_ids) ? b.member_ids : [],
    );
    if (!people.length) return fail('INVALID', 400, { message: 'Nobody selected.' });

    /* Notify only the people who were genuinely NEW.
     *
     * inviteMembers ignores duplicates, so re-running a group target quietly
     * skips those already on the list. Announcing to the resolved set instead
     * would send a second "you have been invited" to everyone who was already
     * coming — the failure people actually notice and complain about. */
    const before = new Set((await participantsOf(meetingId, { withMembers: false })).map(p => p.member_id));
    const added = await inviteMembers(meetingId, people);
    const fresh = people.map(p => p.id).filter(id => !before.has(id));

    const notice = fresh.length
      ? await notifyMeeting(meeting, 'created', { memberIds: fresh })
      : { sent: 0 };

    await logAudit({
      action: 'MEETING_PARTICIPANTS_ADDED', actor: admin?.username || 'admin',
      details: `${meeting.title}: +${added.added}`.slice(0, 200), ip: clientIp(req),
    });
    return ok({
      added: added.added, notified: notice.sent,
      message: added.added
        ? `${added.added} added, ${notice.sent} notified.`
        : 'Everyone selected was already invited.',
    });
  }

  // ── Change someone's capacity ──
  if (b.action === 'set_role') {
    const memberId = String(b.member_id || '').trim();
    const role = String(b.role || '').trim();
    if (!memberId || !PARTICIPANT_ROLES.includes(role))
      return fail('INVALID', 400, { message: 'Choose a valid role.' });

    /* The host is not demotable here.
     *
     * Every meeting must have exactly one host, and a meeting whose host was
     * turned into a participant is one nobody can start or end. Changing who
     * hosts is an edit to the meeting, where a replacement is named. */
    if (String(meeting.host_id) === memberId)
      return fail('INVALID', 400, { message: 'Change the host by editing the meeting.' });

    await sb.from('meeting_participants').update({ role })
      .eq('meeting_id', meetingId).eq('member_id', memberId);

    // co_host_ids on the meeting is what the token endpoint will read, so the
    // two representations are kept in step here rather than trusted to agree.
    const set = new Set((meeting.co_host_ids || []).map(String));
    role === 'co_host' ? set.add(memberId) : set.delete(memberId);
    await sb.from('meetings').update({ co_host_ids: [...set] }).eq('id', meetingId);

    await logAudit({
      action: 'MEETING_ROLE_CHANGED', actor: admin?.username || 'admin',
      details: `${meeting.title}: ${role}`.slice(0, 200), ip: clientIp(req),
    });
    return ok({ message: `Role updated to ${role.replace('_', '-')}.` });
  }

  // ── Remove someone ──
  if (b.action === 'remove') {
    const memberId = String(b.member_id || '').trim();
    if (!memberId) return fail('INVALID', 400, { message: 'Missing member.' });
    if (String(meeting.host_id) === memberId)
      return fail('INVALID', 400, { message: 'The host cannot be removed from their own meeting.' });

    // Attendance rows are deliberately left alone. If this person attended,
    // that happened, and un-inviting them afterwards must not rewrite the
    // record of who was in the room.
    await sb.from('meeting_participants').delete()
      .eq('meeting_id', meetingId).eq('member_id', memberId);
    await sb.from('meetings').update({
      co_host_ids: (meeting.co_host_ids || []).filter(id => String(id) !== memberId),
    }).eq('id', meetingId);

    await logAudit({
      action: 'MEETING_PARTICIPANT_REMOVED', actor: admin?.username || 'admin',
      details: meeting.title?.slice(0, 200), ip: clientIp(req),
    });
    return ok({ message: 'Participant removed.' });
  }

  return fail('INVALID', 400, { message: 'Unknown action.' });
}
