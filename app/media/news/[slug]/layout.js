import { supabaseAdmin } from '@/lib/supabaseServer';

/* Link previews for a shared news story.
 *
 * WhatsApp, Facebook and X do not run JavaScript when they unfurl a link. The
 * article page is a client component, so its headline and cover only exist
 * after React has run — far too late. Without this, a shared story arrives as
 * a bare URL under the site's generic description, and a bare URL in a
 * WhatsApp group gets scrolled past.
 *
 * A LAYOUT solves it without rewriting the page: layouts are server
 * components, so generateMetadata runs on the server.
 */
export const revalidate = 3600;

const SITE = 'https://www.mytnr.org';

async function getPost(slug) {
  // supabaseAdmin() throws when the environment is unconfigured. Metadata must
  // never be the thing that fails a build — the page matters more than its
  // preview card.
  try {
    const nowIso = new Date().toISOString();
    const { data } = await supabaseAdmin().from('news_posts')
      .select('title, summary, cover_url, category, publish_at, created_at, author_name, expires_at, status')
      .eq('slug', slug).eq('status', 'published').maybeSingle();
    if (!data) return null;
    // Scheduled or expired posts must not leak their headline through a
    // preview card either.
    if (data.publish_at && data.publish_at > nowIso) return null;
    if (data.expires_at && data.expires_at < nowIso) return null;
    return data;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }) {
  const slug = params?.slug;
  const p = await getPost(slug);

  if (!p) {
    return {
      title: 'News — Tehreek-e-Nojawanan Roundu',
      description: 'Official updates from Tehreek-e-Nojawanan Roundu.',
    };
  }

  const url = `${SITE}/media/news/${slug}`;
  const title = p.title || 'News';
  const description = (p.summary || '').slice(0, 300)
    || 'An update from Tehreek-e-Nojawanan Roundu.';
  // Falls back to the logo so a story without a cover still unfurls with a
  // picture rather than a grey box.
  const image = p.cover_url || `${SITE}/tnr-logo.png`;

  return {
    title: `${title} — TNR News`,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      url, title, description,
      siteName: 'Tehreek-e-Nojawanan Roundu',
      images: [{ url: image, width: 1200, height: 630, alt: title }],
      publishedTime: p.publish_at || p.created_at || undefined,
      section: p.category || undefined,
      authors: p.author_name ? [p.author_name] : undefined,
    },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
  };
}

export default function NewsLayout({ children }) {
  return children;
}
