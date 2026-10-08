import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireMember } from '@/lib/membership/auth';
import { canReviewCecApplications } from '@/lib/membership/roles';
import { ok, fail } from '@/lib/api';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

/* UC Coordinator applications, for sitting CEC members to read on the
 * Interview Panel page of their own portal.
 *
 * The same two rules as Executive Applications (member/cec-applications), for
 * the same reasons, enforced here so they hold if the endpoint is called
 * directly:
 *
 *   1. Only CEC members and the named reviewers in lib/membership/roles.js may
 *      read this at all.
 *   2. Contact details — WhatsApp and email — are withheld. A committee member
 *      reads the application to advise on it; the numbers belong to the admins
 *      who run the process.
 *
 * READ ONLY. The decision — Pending, Shortlisted, Interview, Selected,
 * Rejected — stays with admins in the panel, where every change is audited.
 * The admin's private notes are not sent either.
 */
const FIELDS = 'id, round_id, reference_no, full_name, membership_id, union_council, '
  + 'permanent_address, current_residence, education, profession, motivation, '
  + 'status, submitted_at, created_at';

export async function GET(req) {
  const { member, res } = await requireMember(req); if (res) return res;

  /* A plain "not for you" rather than a 403. Advisory Council members open the
   * same Interview Panel page, and memberApi treats any 403 as an expired
   * session — signs the member out and sends them to the login screen. Nothing
   * is returned except the flag. */
  if (!canReviewCecApplications(member)) {
    return ok({ allowed: false, round: null, applications: [] });
  }

  const sb = supabaseAdmin();

  /* The open round if there is one, otherwise the most recent — once a round
   * closes the committee is still reviewing it, and an empty screen on the day
   * after the deadline would be exactly wrong. */
  const { data: rounds, error: rErr } = await sb.from('uc_coordinator_rounds')
    .select('id, title, status, closes_on, created_at')
    .in('status', ['open', 'closed'])
    .order('created_at', { ascending: false });
  if (rErr) {
    return fail('READ_FAILED', 500, { message: 'Could not read the recruitment rounds.' });
  }

  const round = (rounds || []).find(r => r.status === 'open') || (rounds || [])[0] || null;
  if (!round) return ok({ allowed: true, round: null, applications: [] });

  const { data, error } = await sb.from('uc_coordinator_applications')
    .select(FIELDS).eq('round_id', round.id)
    .order('union_council').order('created_at', { ascending: false });
  if (error) {
    return fail('READ_FAILED', 500, { message: 'Could not read the applications.' });
  }

  return ok({ allowed: true, round, applications: data || [] });
}
