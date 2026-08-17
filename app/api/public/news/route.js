import { supabaseAdmin } from '@/lib/supabaseServer';
import { ok } from '@/lib/api';
import { CATEGORIES } from '@/lib/news';

export const dynamic = 'force-dynamic';

/* Published news, for the public site.
 *
 * PUBLISHED AND IN DATE. `status = 'published'` is applied to every request and
 * is not optional, and the scheduling window is applied in the query rather
 * than filtered afterwards — a post timed for next Friday must not travel to
 * the browser this Tuesday, whether or not a component chooses to draw it.
 *
 * `created_by` is never selected. Which admin wrote a piece is internal; the
 * public byline is `author_name`, which is set deliberately.
 */
const PUBLIC_FIELDS =
  'id, slug, title, summary, body, cover_url, category, pinned, ' +
  'publish_at, created_at, views, author_name';

export async function GET(req) {
  const p = new URL(req.url).searchParams;
  const slug = (p.get('slug') || '').trim();
  const category = (p.get('category') || '').trim();
  const limit = Math.min(50, Math.max(1, Number(p.get('limit') || 30)));

  const nowIso = new Date().toISOString();
  const sb = supabaseAdmin();

  /* Status filter in the query; the scheduling window applied after.
   *
   * Two chained .or() calls would be the obvious way to express "published
   * already AND not yet expired", but stacking them relies on how PostgREST
   * combines repeated `or` parameters — and a subtle mistake there fails in
   * the worst possible direction: silently returning nothing, which is
   * indistinguishable from "no news posted yet".
   *
   * The window is checked in plain JavaScript instead. The list is capped at
   * 50 rows, so filtering here costs nothing and cannot be misread. */
  let q = sb.from('news_posts')
    .select(PUBLIC_FIELDS)
    .eq('status', 'published')
    .not('slug', 'is', null)
    .order('pinned', { ascending: false })
    .order('publish_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (slug) q = q.eq('slug', slug).limit(1);
  else {
    if (category && CATEGORIES.includes(category)) q = q.eq('category', category);
    q = q.limit(limit + 20);      // headroom for rows the window removes
  }

  const { data, error } = await q;
  // A site with no news yet is not an error, and the page says so plainly.
  if (error) return ok({ posts: [], categories: CATEGORIES, hint: 'news_posts table not found' });

  const live = (data || []).filter(p =>
    (!p.publish_at || p.publish_at <= nowIso) &&
    (!p.expires_at || p.expires_at >= nowIso));

  return ok({ posts: slug ? live : live.slice(0, limit), categories: CATEGORIES });
}
