import { supabaseAdmin } from '@/lib/supabaseServer';

/* Link previews for a shared opinion.
 *
 * WhatsApp, Facebook and X do not run JavaScript when they unfurl a link —
 * they read the HTML that comes back and nothing more. The article page is a
 * client component, so its title and cover appear only after React has run,
 * which is far too late. Shared links were arriving as a bare URL with the
 * site's generic description under them.
 *
 * A LAYOUT solves it without rewriting the page: layouts are server
 * components, generateMetadata runs on the server, and the client page below
 * carries on unchanged.
 *
 * Revalidated hourly. A title correction should reach the platforms eventually,
 * but they cache aggressively anyway, so re-querying per request would buy
 * nothing and cost a round trip on every read.
 */
export const revalidate = 3600;

const SITE = 'https://www.mytnr.org';

async function getOpinion(slug) {
  // supabaseAdmin() throws when the environment is not configured. Metadata
  // must never be the thing that fails a build — the page itself is more
  // important than its preview card.
  try {
    const { data } = await supabaseAdmin().from('opinions')
      .select('published_title, published_summary, published_cover, published_at, member_id')
      .eq('slug', slug).eq('status', 'published').maybeSingle();
    if (!data) return null;

    let author = null;
    if (data.member_id) {
      const { data: m } = await supabaseAdmin().from('membership_members')
        .select('full_name').eq('id', data.member_id).is('deleted_at', null).maybeSingle();
      author = m?.full_name || null;
    }
    return { ...data, author };
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }) {
  const slug = params?.slug;
  const o = await getOpinion(slug);

  if (!o) {
    return {
      title: 'Opinion — Tehreek-e-Nojawanan Roundu',
      description: 'Views from TNR members on education, leadership, service and the future of Roundu.',
    };
  }

  const url = `${SITE}/media/opinions/${slug}`;
  const title = o.published_title || 'Opinion';
  const description = (o.published_summary || '').slice(0, 300)
    || 'A member’s view, published on the TNR community platform.';
  // Falls back to the site logo so a piece without a cover still unfurls with
  // a picture rather than a grey box.
  const image = o.published_cover || `${SITE}/tnr-logo.png`;

  return {
    title: `${title} — TNR Opinions`,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      url,
      title,
      description,
      siteName: 'Tehreek-e-Nojawanan Roundu',
      images: [{ url: image, width: 1200, height: 630, alt: title }],
      publishedTime: o.published_at || undefined,
      authors: o.author ? [o.author] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
  };
}

export default function OpinionLayout({ children }) {
  return children;
}
