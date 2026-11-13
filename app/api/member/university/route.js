import { supabaseAdmin } from '@/lib/supabaseServer';
import { ok, fail } from '@/lib/api';
import { requireUniversityAmbassador, scopedMembers } from '@/lib/university/access';
import { isStudent, isNew, monthlyTrend } from '@/lib/university/scope';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/* GET /api/member/university?u=<university id>
 *
 * The ambassador's overview: which universities they cover, and for the
 * selected one, the headline numbers and a twelve-month registration trend.
 *
 * Every figure is counted from membership_members through scopedMembers(), so
 * the numbers on the cards are the same people the directory lists — not a
 * separately maintained counter that can drift from it. */
export async function GET(req) {
  const u = new URL(req.url).searchParams.get('u');
  const { scope, universities, res } = await requireUniversityAmbassador(req, u);
  if (res) return res;

  const sb = supabaseAdmin();

  /* Only the columns the statistics need. A university with a few hundred
     TNR members is a few kilobytes here; this is not the directory. */
  const { data: rows, error } = await scopedMembers(sb, scope,
    'id, current_position, approved_at, created_at').limit(10000);
  if (error) return fail('LOAD_FAILED', 500, { message: 'Could not load your university.' });

  const members = rows || [];
  const ids = members.map(m => m.id);

  /* Follow-up counts are restricted to members STILL in scope. A follow-up
     raised on someone who has since changed university is not this
     ambassador's to chase, and counting it would put a number on the card
     that the directory cannot show them. */
  let followup = 0;
  if (ids.length) {
    const { data: f } = await sb.from('university_member_followups')
      .select('member_id').eq('university_id', scope.universityId)
      .eq('status', 'needs_followup').in('member_id', ids);
    followup = (f || []).length;
  }

  const students = members.filter(isStudent).length;

  return ok({
    universities,
    selected: scope.universityId,
    campusScoped: !!scope.campusIds,
    stats: {
      total: members.length,
      students,
      not_studying: members.length - students,
      new_30d: members.filter(m => isNew(m, 30)).length,
      needs_followup: followup,
    },
    trend: monthlyTrend(members),
  });
}
