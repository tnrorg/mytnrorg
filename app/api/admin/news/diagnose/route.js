import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAdmin } from '@/lib/guard';
import { ok } from '@/lib/api';

export const dynamic = 'force-dynamic';

/* Why isn't my news showing?
 *
 * Four things must all be true for a post to appear in public, and when one of
 * them is false the site shows the same thing as when none of them are: an
 * empty section. That ambiguity is the actual problem — "no news yet" and
 * "the table does not exist" look identical from the outside.
 *
 * This answers which one it is, in one request.
 */
export async function GET(req) {
  const { res } = requireAdmin(req); if (res) return res;
  const sb = supabaseAdmin();
  const nowIso = new Date().toISOString();

  const { data, error } = await sb.from('news_posts')
    .select('id, title, slug, status, publish_at, expires_at');

  if (error) {
    return ok({
      ready: false,
      problem: 'TABLE_MISSING',
      message: 'The news_posts table does not exist yet.',
      fix: 'Run supabase/migration_news.sql in the Supabase SQL Editor, then reload.',
      detail: error.message,
    });
  }

  const rows = data || [];
  const drafts = rows.filter(p => p.status !== 'published');
  const published = rows.filter(p => p.status === 'published');
  const noSlug = published.filter(p => !p.slug);
  const scheduled = published.filter(p => p.publish_at && p.publish_at > nowIso);
  const expired = published.filter(p => p.expires_at && p.expires_at < nowIso);
  const live = published.filter(p =>
    p.slug && (!p.publish_at || p.publish_at <= nowIso) && (!p.expires_at || p.expires_at >= nowIso));

  let problem = null, message = null, fix = null;
  if (!rows.length) {
    problem = 'NO_POSTS';
    message = 'The table exists but contains no posts at all.';
    fix = 'Write one under Admin → News & Announcements and press "Publish to website".';
  } else if (!published.length) {
    problem = 'ALL_DRAFTS';
    message = `All ${rows.length} post(s) are still drafts.`;
    fix = 'Open the post and press "Publish to website" — "Save draft" keeps it private.';
  } else if (!live.length) {
    problem = scheduled.length ? 'SCHEDULED'
      : expired.length ? 'EXPIRED'
      : noSlug.length ? 'NO_SLUG' : 'UNKNOWN';
    message = scheduled.length ? 'Published, but the publish date is still in the future.'
      : expired.length ? 'Published, but the "Hide after" date has already passed.'
      : noSlug.length ? 'Published but with no URL slug — this should not happen.'
      : 'Published posts exist but none are live.';
    fix = scheduled.length ? 'Clear the "Publish at" field, or wait for that time.'
      : expired.length ? 'Clear or extend the "Hide after" field.'
      : 'Re-publish the post to regenerate its link.';
  }

  return ok({
    ready: live.length > 0,
    problem, message, fix,
    server_time: nowIso,
    counts: {
      total: rows.length, drafts: drafts.length, published: published.length,
      live: live.length, scheduled: scheduled.length, expired: expired.length,
      missing_slug: noSlug.length,
    },
    // Titles only — enough to recognise a post without dumping its contents.
    live_titles: live.slice(0, 10).map(p => ({ title: p.title, slug: p.slug })),
  });
}
