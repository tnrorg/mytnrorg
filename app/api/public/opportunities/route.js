import { supabaseAdmin } from '@/lib/supabaseServer';
import { ok } from '@/lib/api';
import { publicSelect, publicStatus, CATEGORIES } from '@/lib/opportunities';

export const dynamic = 'force-dynamic';

/* Public opportunity listing — THE TEASER, AND ONLY THE TEASER.
 *
 * This endpoint selects `publicSelect()`, an explicit column list from
 * lib/opportunities.js. It does not select *. That is the security boundary,
 * and it is deliberately expressed as "name the safe columns" rather than
 * "fetch the row then delete the private parts": the second approach means the
 * protected text has already been read into memory and is one careless
 * `...spread` away from the response.
 *
 * There is no way to widen it from the outside. No query parameter, header or
 * body value influences which columns are selected, so an unauthenticated
 * caller cannot obtain eligibility, benefits, instructions, terms, the
 * application URL or the full description from here — whatever they send.
 *
 * Full details live behind requireMember at /api/member/opportunities.
 */
export async function GET(req) {
  const p = new URL(req.url).searchParams;
  const category = (p.get('category') || '').trim();
  const limit = Math.min(60, Math.max(1, Number(p.get('limit') || 40)));

  const sb = supabaseAdmin();

  let q = sb.from('opportunities')
    .select(publicSelect())
    .eq('status', 'published')          // drafts and archives are not public
    .order('pinned', { ascending: false })
    .order('deadline', { ascending: true, nullsFirst: false })
    .limit(limit);

  if (category && CATEGORIES.includes(category)) q = q.eq('category', category);

  const { data, error } = await q;
  // An empty board is not an error, and the page says so plainly.
  if (error) return ok({ opportunities: [], categories: CATEGORIES });

  const now = Date.now();
  return ok({
    categories: CATEGORIES,
    /* `state` is computed here so every surface — public cards, portal cards,
     * admin list — shows the same badge from the same rule, rather than three
     * components each deciding for themselves what "closing soon" means. */
    opportunities: (data || []).map(o => ({ ...o, state: publicStatus(o, now) })),
  });
}
