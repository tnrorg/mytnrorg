import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireMember } from '@/lib/membership/auth';
import { canReviewCecApplications } from '@/lib/membership/roles';
import { ok, fail } from '@/lib/api';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

/* Executive Committee applications, for sitting CEC members to read in their
 * own portal.
 *
 * Two rules, both enforced here rather than in the UI so they hold even if the
 * endpoint is called directly:
 *
 *   1. Only a sitting CEC member may read this at all. Applications contain
 *      other people's contact details and their written answers.
 *   2. Contact details are withheld from this view. A committee member is here
 *      to judge the answers; the phone numbers belong to the panel that
 *      actually runs the process, and there is no reason for every CEC member
 *      to hold a list of applicants' mobile numbers.
 */
export async function GET(req) {
  const { member, res } = await requireMember(req); if (res) return res;

  /* Sitting CEC members, plus the named reviewers in lib/membership/roles.js
   * — currently the founder, who reviews these but does not hold the `cec`
   * role. The rule lives there so this endpoint and the portal's navigation
   * cannot disagree about who is allowed in. */
  if (!canReviewCecApplications(member)) {
    return fail('FORBIDDEN', 403, {
      message: 'Only Central Executive Committee members can view these applications.',
    });
  }

  const sb = supabaseAdmin();
  const { data, error } = await sb.from('cec_applications')
    // photo_url is included, contact details are still not. A reviewer needs
    // to know which application belongs to whom; they do not need everyone's
    // mobile number.
    .select('id, reference_no, vacancy_id, full_name, photo_url, education_level, current_position, ' +
            'organisation, union_council, village, relevant_experience, scenario_answer, ' +
            'challenge_answer, leadership_answer, vision_answer, status, created_at')
    .order('created_at', { ascending: false });
  if (error) {
    return fail('READ_FAILED', 500, {
      message: error.message,
      hint: 'Run supabase/migration_cec_recruitment.sql in the Supabase SQL Editor.',
    });
  }

  const { data: vacancies } = await sb.from('cec_vacancies').select('id, title, scenario_question');
  const byId = Object.fromEntries((vacancies || []).map(v => [v.id, v]));

  return ok({
    applications: (data || []).map(a => ({
      ...a,
      position: byId[a.vacancy_id]?.title || '—',
      scenario_question: byId[a.vacancy_id]?.scenario_question || '',
    })),
    // The portal shows this so a committee member is not left wondering why
    // there are no buttons to act on what they are reading.
    readonly: true,
  });
}
