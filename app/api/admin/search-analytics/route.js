import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAdmin } from '@/lib/guard';
import { ok, fail } from '@/lib/api';
import { typeLabel } from '@/lib/search/types';

export const dynamic = 'force-dynamic';

/* What visitors search for — aggregated, and nothing else.
 *
 * The table holds a daily count per term (see supabase/migration_search.sql);
 * there is no record of who searched. Two further limits apply here:
 *
 *   • A term is shown only once it has been searched MIN_SHOWN times in the
 *     period. People search for other people; a single search for somebody's
 *     name is one visitor's private curiosity, not a trend, and is not
 *     displayed to anyone.
 *   • Rows older than RETENTION_DAYS are deleted whenever this is opened.
 */
const MIN_SHOWN = 3, MIN_SHOWN_ZERO = 2, RETENTION_DAYS = 180;
const day = (offset) => new Date(Date.now() - offset * 86400000).toISOString().slice(0, 10);

export async function GET(req) {
  const { res } = await requireAdmin(req); if (res) return res;
  const sb = supabaseAdmin();
  const days = Math.min(90, Math.max(7, parseInt(new URL(req.url).searchParams.get('days'), 10) || 30));

  await sb.from('search_stats_daily').delete().lt('day', day(RETENTION_DAYS)).then(() => {}, () => {});

  const { data, error } = await sb.from('search_stats_daily')
    .select('day, kind, key, hits, ms_total').gte('day', day(days)).limit(50000);
  if (error) {
    if (/does not exist|schema cache/i.test(error.message || ''))
      return fail('SCHEMA_OUT_OF_DATE', 500, {
        message: 'Search analytics is not set up yet.', hint: 'Run supabase/migration_search.sql.' });
    return fail('LOAD_FAILED', 500, { message: 'Could not load search analytics.' });
  }

  const terms = new Map(), zero = new Map(), clicks = new Map(), perDay = new Map();
  let searches = 0, ms = 0, zeroSearches = 0;
  for (const r of data || []) {
    if (r.kind === 'click') { clicks.set(r.key, (clicks.get(r.key) || 0) + r.hits); continue; }
    searches += r.hits; ms += Number(r.ms_total) || 0;
    perDay.set(r.day, (perDay.get(r.day) || 0) + r.hits);
    if (r.kind === 'zero') { zeroSearches += r.hits; zero.set(r.key, (zero.get(r.key) || 0) + r.hits); }
    else terms.set(r.key, (terms.get(r.key) || 0) + r.hits);
  }
  const top = (m, min) => [...m.entries()].filter(([, n]) => n >= min)
    .sort((a, b) => b[1] - a[1]).slice(0, 25).map(([term, hits]) => ({ term, hits }));

  const trend = [];
  for (let i = days - 1; i >= 0; i--) trend.push({ day: day(i), searches: perDay.get(day(i)) || 0 });

  return ok({
    days,
    totals: {
      searches,
      zero_result: zeroSearches,
      zero_rate: searches ? Math.round((zeroSearches / searches) * 100) : 0,
      avg_ms: searches ? Math.round(ms / searches) : null,
      result_opens: [...clicks.values()].reduce((a, b) => a + b, 0),
    },
    top_terms: top(terms, MIN_SHOWN),
    zero_terms: top(zero, MIN_SHOWN_ZERO),
    categories: [...clicks.entries()].sort((a, b) => b[1] - a[1])
      .map(([type, hits]) => ({ type, label: typeLabel(type), hits })),
    trend,
    thresholds: { term: MIN_SHOWN, zero: MIN_SHOWN_ZERO, retention_days: RETENTION_DAYS },
  });
}
