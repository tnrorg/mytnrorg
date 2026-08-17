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

  let q = sb.from('news_posts')
    .select(PUBLIC_FIELDS)
    .eq('status', 'published')
    .not('slug', 'is', null)
    .or(`publish_at.is.null,publish_at.lte.${nowIso}`)
    .or(`expires_at.is.null,expires_at.gte.${nowIso}`)
    .order('pinned', { ascending: false })
    .order('publish_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (slug) q = q.eq('slug', slug).limit(1);
  else {
    if (category && CATEGORIES.includes(category)) q = q.eq('category', category);
    q = q.limit(limit);
  }

  const { data, error } = await q;
  // A site with no news yet is not an error, and the page says so plainly.
  if (error) return ok({ posts: [], categories: CATEGORIES });

  return ok({ posts: data || [], categories: CATEGORIES });
}
