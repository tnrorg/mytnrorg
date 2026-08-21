import { supabaseAdmin } from '@/lib/supabaseServer';
import { ok } from '@/lib/api';
import { publicSelect, publicSelectBase, publicStatus, CATEGORIES } from '@/lib/opportunities';

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

  /* Try the full teaser, fall back to the columns that have always existed.
   *
   * Postgres refuses a whole query for one unknown column. Without this
   * fallback, an environment where migration_opportunities_v2.sql has not run
   * returns NOTHING — while the admin panel, which selects *, lists the same
   * opportunity perfectly. "Published in admin, absent from the site" is then
   * the only symptom, and it points nowhere near the real cause.
   *
   * `pinned` is in the new set, so the ordering is applied per attempt. */
  const build = (cols, withV2) => {
    let x = sb.from('opportunities')
      .select(cols)
      .eq('status', 'published');       // drafts and archives are not public
    if (withV2) x = x.order('pinned', { ascending: false });
    x = x.order('deadline', { ascending: true, nullsFirst: false }).limit(limit);
    if (category && CATEGORIES.includes(category)) x = x.eq('category', category);
    return x;
  };

  let degraded = false;
  let { data, error } = await build(publicSelect(), true);
  if (error) {
    ({ data, error } = await build(publicSelectBase(), false));
    degraded = !error;
  }

  if (error) return ok({
    opportunities: [], categories: CATEGORIES,
    why: { stage: 'query_failed', message: error.message },
  });

  const now = Date.now();
  const rows = data || [];

  return ok({
    categories: CATEGORIES,
    /* `state` is computed here so every surface — public cards, portal cards,
     * admin list — shows the same badge from the same rule, rather than three
     * components each deciding for themselves what "closing soon" means. */
    opportunities: rows.map(o => ({ ...o, state: publicStatus(o, now) })),
    // Says WHICH step produced an empty board, instead of leaving four
    // different causes looking identical from the outside.
    why: rows.length ? undefined : {
      stage: degraded ? 'migration_pending' : 'no_published_rows',
      message: degraded
        ? 'Reading legacy columns only — run supabase/migration_opportunities_v2.sql.'
        : 'No opportunity has status = published.',
      category_filter: category || null,
      server_now: new Date(now).toISOString(),
    },
    ...(degraded ? { migration_pending: true } : {}),
  });
}
