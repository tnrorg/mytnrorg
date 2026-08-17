import { supabaseAdmin } from '@/lib/supabaseServer';

/* Sitemap for Google Search Console.
 *
 * Next serves whatever this returns at /sitemap.xml. It is generated from the
 * live database rather than written by hand, so a member approved tomorrow is
 * in the sitemap tomorrow without anyone remembering to add them.
 *
 * WHAT IS DELIBERATELY ABSENT
 * The admin panel, the member portal, /membership/status and the super-admin
 * tools. Those are either private or personal, next.config.js already sends
 * them X-Robots-Tag: noindex, and listing a page here that the headers tell
 * Google not to index is a contradiction Search Console reports as an error.
 *
 * FAILURE BEHAVIOUR
 * Every database read is wrapped. A sitemap that returns a 500 is worse than
 * one missing some URLs — Search Console records the fetch as failed and stops
 * trying for a while — so on any error this still returns the static pages.
 */

const BASE = 'https://www.mytnr.org';

// Re-read hourly. Members and office bearers change on a human timescale, and
// Google does not re-fetch a sitemap more often than that anyway.
export const revalidate = 3600;

/* Fixed pages, with the priorities they actually deserve relative to one
 * another. Priority is a hint about relative importance within this site — it
 * says nothing to Google about ranking against anyone else. */
const STATIC_ROUTES = [
  ['',                              1.0, 'daily'],
  ['/about',                        0.8, 'monthly'],
  ['/about/vision-mission',         0.7, 'monthly'],
  ['/about/governance',             0.6, 'monthly'],
  ['/about/constitution',           0.6, 'yearly'],
  ['/about/code-of-conduct',        0.6, 'yearly'],
  ['/about/office-bearers',         0.8, 'monthly'],
  ['/about/advisory-council',       0.8, 'weekly'],
  ['/about/executive-committee',    0.8, 'weekly'],
  ['/members',                      0.9, 'daily'],
  ['/membership',                   0.9, 'monthly'],
  ['/membership/apply',             0.9, 'monthly'],
  ['/membership/verify',            0.7, 'monthly'],
  ['/statistics',                   0.7, 'weekly'],
  ['/statistics/education',         0.6, 'weekly'],
  ['/statistics/employment',        0.6, 'weekly'],
  ['/statistics/projects',          0.6, 'weekly'],
  ['/cec/apply',                    0.6, 'monthly'],
  ['/media/opinions',               0.8, 'weekly'],
  ['/media/news',                   0.9, 'daily'],
  ['/contact',                      0.5, 'yearly'],
  ['/election-portal',              0.5, 'weekly'],
  ['/results',                      0.5, 'weekly'],
];

export default async function sitemap() {
  const now = new Date();

  const routes = STATIC_ROUTES.map(([path, priority, changeFrequency]) => ({
    url: `${BASE}${path}`,
    lastModified: now,
    changeFrequency,
    priority,
  }));

  /* supabaseAdmin() THROWS when the environment is not configured, and this
   * function runs during the build. Called outside a try — as it was — a
   * missing variable would not degrade the sitemap, it would fail the whole
   * deploy and leave the previous version of the site live. Returning the
   * static routes is the right failure: an incomplete sitemap beats no site. */
  let sb;
  try {
    sb = supabaseAdmin();
  } catch {
    return routes;
  }

  /* Leadership profiles — /council/[slug].
   *
   * There are two routes rendering the same person: /council/[slug] and
   * /about/{advisory-council,executive-committee}/[slug]. Only the first is
   * listed. Submitting both would be duplicate content, and Google would pick
   * a canonical itself — better to state which one matters. */
  try {
    const { data } = await sb.from('leadership_profiles')
      .select('slug, updated_at')
      .eq('active', true)
      .not('slug', 'is', null);

    for (const p of data || []) {
      if (!p.slug) continue;
      routes.push({
        url: `${BASE}/council/${encodeURIComponent(p.slug)}`,
        lastModified: p.updated_at ? new Date(p.updated_at) : now,
        changeFrequency: 'monthly',
        priority: 0.7,
      });
    }
  } catch { /* static routes still ship */ }

  /* Member profiles — /members/[membership_id].
   *
   * Three filters, and none of them is optional:
   *   status         approved or active only — never pending or rejected
   *   deleted_at     soft-deleted members are gone, not merely hidden
   *   public_visible a member an admin has withheld from the public directory
   *                  must not be handed to a search engine instead. That
   *                  setting exists for safety and family reasons, and a
   *                  sitemap that ignored it would quietly undo it.
   */
  try {
    const PAGE = 1000;
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await sb.from('membership_members')
        .select('membership_id, updated_at')
        .in('status', ['approved', 'active'])
        .is('deleted_at', null)
        .not('public_visible', 'is', false)
        .not('membership_id', 'is', null)
        .range(from, from + PAGE - 1);

      if (error || !data?.length) break;

      for (const m of data) {
        if (!m.membership_id) continue;
        routes.push({
          url: `${BASE}/members/${encodeURIComponent(m.membership_id)}`,
          lastModified: m.updated_at ? new Date(m.updated_at) : now,
          changeFrequency: 'monthly',
          priority: 0.5,
        });
      }
      // Paginated rather than a single read: Supabase caps a request at 1000
      // rows, so a flat select would silently stop listing members past the
      // thousandth — the same trap the dashboard counters had.
      if (data.length < PAGE) break;
    }
  } catch { /* static and leadership routes still ship */ }

  /* Published opinions — /media/opinions/[slug].
   *
   * Only `published`, and only rows that actually have a slug. A piece that is
   * pending, withdrawn or rejected has no public page, and listing it would
   * send Google to a "not found". */
  try {
    const { data } = await sb.from('opinions')
      .select('slug, published_at')
      .eq('status', 'published')
      .not('slug', 'is', null)
      .limit(1000);

    for (const o of data || []) {
      if (!o.slug) continue;
      routes.push({
        url: `${BASE}/media/opinions/${encodeURIComponent(o.slug)}`,
        lastModified: o.published_at ? new Date(o.published_at) : now,
        changeFrequency: 'monthly',
        priority: 0.6,
      });
    }
  } catch { /* the table may not exist yet */ }

  /* Published news — /media/news/[slug].
   *
   * Same rules as opinions, plus the scheduling window: a story timed for next
   * Friday must not be handed to Google this Tuesday, and one that has expired
   * should stop being advertised. */
  try {
    const nowIso = new Date().toISOString();
    const { data } = await sb.from('news_posts')
      .select('slug, publish_at, created_at, expires_at')
      .eq('status', 'published')
      .not('slug', 'is', null)
      .or(`publish_at.is.null,publish_at.lte.${nowIso}`)
      .or(`expires_at.is.null,expires_at.gte.${nowIso}`)
      .limit(1000);

    for (const p of data || []) {
      if (!p.slug) continue;
      routes.push({
        url: `${BASE}/media/news/${encodeURIComponent(p.slug)}`,
        lastModified: new Date(p.publish_at || p.created_at || now),
        changeFrequency: 'monthly',
        priority: 0.7,
      });
    }
  } catch { /* the table may not exist yet */ }

  return routes;
}
