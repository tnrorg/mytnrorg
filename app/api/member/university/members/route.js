import { supabaseAdmin } from '@/lib/supabaseServer';
import { ok, fail } from '@/lib/api';
import { requireUniversityAmbassador, scopedMembers } from '@/lib/university/access';
import { toDirectoryRow, sanitizeSearch, FOLLOWUP_KEYS } from '@/lib/university/scope';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const SORTS = { name: 'full_name', joined: 'approved_at', id: 'membership_id' };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* GET /api/member/university/members
 *   ?u=<university>&q=<search>&kind=all|student|not_studying
 *   &followup=<status>&sort=name|joined|id&dir=asc|desc&page=1&per=25
 *
 * Searching, filtering, sorting and paging all happen HERE, in the database
 * query that already carries the scope. The browser receives one page of
 * members it is allowed to see — never the whole university to filter
 * locally, which would mean every row had already left the server. */
export async function GET(req) {
  const p = new URL(req.url).searchParams;
  const { scope, res } = await requireUniversityAmbassador(req, p.get('u'));
  if (res) return res;

  const sb = supabaseAdmin();
  const per = Math.min(100, Math.max(5, parseInt(p.get('per'), 10) || 25));
  const page = Math.max(1, parseInt(p.get('page'), 10) || 1);
  const sortCol = SORTS[p.get('sort')] || 'full_name';
  const asc = p.get('dir') !== 'desc';

  let q = scopedMembers(sb, scope, undefined, { count: 'exact' });

  const search = sanitizeSearch(p.get('q'));
  if (search) q = q.or(`full_name.ilike.%${search}%,membership_id.ilike.%${search}%`);

  const kind = p.get('kind');
  if (kind === 'student') q = q.eq('current_position', 'Student');
  /* `neq` alone would drop members with no position at all, who are not
     students either — so they are included explicitly. */
  if (kind === 'not_studying') q = q.or('current_position.is.null,current_position.neq.Student');

  /* Follow-up filter. The status lives in its own table, so it is turned into
     an id list first — taken from THIS university's follow-ups only. */
  const fu = p.get('followup');
  if (fu && FOLLOWUP_KEYS.includes(fu)) {
    if (fu === 'none') {
      const { data: flagged } = await sb.from('university_member_followups')
        .select('member_id').eq('university_id', scope.universityId).neq('status', 'none');
      const ids = (flagged || []).map(r => r.member_id).filter(id => UUID.test(id));
      if (ids.length) q = q.not('id', 'in', `(${ids.join(',')})`);
    } else {
      const { data: flagged } = await sb.from('university_member_followups')
        .select('member_id').eq('university_id', scope.universityId).eq('status', fu);
      const ids = (flagged || []).map(r => r.member_id);
      if (!ids.length) return ok({ members: [], total: 0, page, per });
      q = q.in('id', ids);
    }
  }

  q = q.order(sortCol, { ascending: asc, nullsFirst: false })
       .order('membership_id', { ascending: true })     // stable paging on ties
       .range((page - 1) * per, page * per - 1);

  const { data: rows, count, error } = await q;
  if (error) return fail('LOAD_FAILED', 500, { message: 'Could not load members.' });

  const list = rows || [];
  const ids = list.map(m => m.id);
  const campusIds = [...new Set(list.map(m => m.university_campus_id).filter(Boolean))];

  const [{ data: fus }, { data: camps }] = await Promise.all([
    ids.length
      ? sb.from('university_member_followups').select('member_id, status')
          .eq('university_id', scope.universityId).in('member_id', ids)
      : Promise.resolve({ data: [] }),
    campusIds.length
      ? sb.from('tnr_university_campuses').select('id, name').in('id', campusIds)
      : Promise.resolve({ data: [] }),
  ]);
  const fuBy = new Map((fus || []).map(f => [f.member_id, f.status]));
  const campBy = new Map((camps || []).map(c => [c.id, c.name]));

  return ok({
    members: list.map(m => toDirectoryRow(m, {
      followup: fuBy.get(m.id) || 'none',
      campusName: campBy.get(m.university_campus_id) || null,
    })),
    total: count ?? list.length,
    page,
    per,
  });
}
