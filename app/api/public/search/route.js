import { supabaseAdmin } from '@/lib/supabaseServer';
import { ok, fail, readJson } from '@/lib/api';
import { clientIp } from '@/lib/audit';
import { search } from '@/lib/search';
import { norm } from '@/lib/search/engine';
import { TAB_KEYS, TYPES } from '@/lib/search/types';

export const dynamic = 'force-dynamic';

/* GET /api/public/search?q=…&tab=all&page=1&mode=suggest|full&final=1
 *
 * PUBLIC, AND THE SAME FOR EVERYONE. The index holds only what a logged-out
 * visitor can already see on the site (see lib/search/providers.js), so this
 * route takes no credentials and has nothing to authorise: there is no private
 * result to withhold from the wrong person, and no "signed-in" variant whose
 * cached response could be served to somebody else.
 *
 * The query is never placed in SQL or in a PostgREST filter — matching happens
 * in memory against the prepared index — so there is no injection surface.
 */

/* Best-effort throttle against scraping: per server instance, in memory.
 * It deliberately does NOT use the database-backed limiter the login and form
 * routes use — that costs two queries per call, which is right for a login and
 * wrong for something fired on every pause in typing. The consequence is that
 * the limit is per instance rather than global; it stops a naive scraper loop,
 * not a distributed one. The directory it protects is public either way. */
const WINDOW_MS = 10_000, MAX_IN_WINDOW = 40;
const seen = new Map();
function limited(ip) {
  if (!ip) return false;
  const now = Date.now();
  if (seen.size > 5000) for (const [k, v] of seen) if (now - v.start > WINDOW_MS) seen.delete(k);
  const r = seen.get(ip);
  if (!r || now - r.start > WINDOW_MS) { seen.set(ip, { start: now, n: 1 }); return false; }
  return ++r.n > MAX_IN_WINDOW;
}

/* What may be recorded as a search term. Aggregated counts only (see
 * supabase/migration_search.sql) — and anything shaped like contact or
 * identity data is not recorded at all, so a visitor who pastes a phone
 * number or an email into the box leaves no trace of it. */
function loggable(raw, term) {
  if (!term || term.length < 2 || term.length > 40) return false;
  /* Tested on what was TYPED, not on the normalised term: normalising strips
     "@" and "-", which would turn an email address or a CNIC into ordinary-
     looking words and let them through. */
  if (/@/.test(raw)) return false;
  if (/\d{5,}/.test(raw.replace(/[\s\-().+]/g, ''))) return false;
  return true;
}
const log = (kind, key, ms = 0) =>
  supabaseAdmin().rpc('tnr_search_log', { p_kind: kind, p_key: key, p_ms: Math.round(ms) })
    .then(() => {}, () => {});       // analytics must never fail a search

const headers = (res) => { res.headers.set('X-Robots-Tag', 'noindex, nofollow'); return res; };

export async function GET(req) {
  if (limited(clientIp(req)))
    return headers(fail('RATE_LIMITED', 429, { message: 'Too many searches. Please wait a few seconds.' }));

  const p = new URL(req.url).searchParams;
  const q = String(p.get('q') || '').slice(0, 80).trim();
  const suggest = p.get('mode') === 'suggest';
  const tab = TAB_KEYS.includes(p.get('tab')) ? p.get('tab') : 'all';
  const per = suggest ? 8 : 20;
  const page = suggest ? 1 : Math.min(50, Math.max(1, parseInt(p.get('page'), 10) || 1));

  if (q.length < 2) return headers(ok({ q, results: [], total: 0, counts: {}, page: 1, per }));

  let out;
  try { out = await search(q, { tab, limit: per, offset: (page - 1) * per }); }
  catch { return headers(fail('SEARCH_UNAVAILABLE', 503, { message: 'Search is temporarily unavailable.' })); }

  /* Logged once per deliberate search — when the results page loads or Enter
     is pressed — not once per keystroke, which would record every prefix of
     every word as though it were a query. */
  if (!suggest && page === 1 && p.get('final') === '1') {
    const term = norm(q);
    if (loggable(q, term)) log(out.counts.all ? 'term' : 'zero', term, out.took_ms);
  }

  return headers(ok({
    q, tab, page, per,
    total: out.total,
    counts: out.counts,
    corrected: !!out.corrected,
    results: out.results,
    took_ms: out.took_ms,
  }));
}

/* POST { type } — a result was opened. Records the CATEGORY only, never which
 * result and never what was searched for. */
export async function POST(req) {
  if (limited(clientIp(req))) return headers(ok({}));
  const b = await readJson(req);
  if (typeof b.type === 'string' && TYPES[b.type]) log('click', b.type);
  return headers(ok({}));
}
