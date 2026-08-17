'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import { ArrowLeft, Clock, Eye, Newspaper } from 'lucide-react';
import SiteNav from '@/components/site/SiteNav';
import SiteFooter from '@/components/site/SiteFooter';
import ShareButtons from '@/components/site/ShareButtons';
import { COLORS, FONT } from '@/lib/design/tokens';
import { paragraphs, readingMinutes, fmtDate, CATEGORY_TONE } from '@/lib/news';

export default function NewsArticle() {
  const { slug } = useParams();
  const [p, setP] = useState(undefined);      // undefined = loading, null = not found
  const [more, setMore] = useState([]);

  useEffect(() => {
    let off = false;
    fetch(`/api/public/news?slug=${encodeURIComponent(slug)}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(j => { if (!off) setP(j?.ok && j.posts?.[0] ? j.posts[0] : null); })
      .catch(() => { if (!off) setP(null); });

    fetch('/api/public/news?limit=4', { cache: 'no-store' })
      .then(r => r.json())
      .then(j => { if (!off) setMore((j?.posts || []).filter(x => x.slug !== slug).slice(0, 3)); })
      .catch(() => {});

    return () => { off = true; };
  }, [slug]);

  /* One read per browser session.
   *
   * sessionStorage rather than localStorage: refreshing an article should not
   * inflate the number, but coming back tomorrow is a genuine second read. */
  useEffect(() => {
    if (!p?.slug) return;
    const KEY = `tnr_news_seen_${p.slug}`;
    try {
      if (sessionStorage.getItem(KEY)) return;
      sessionStorage.setItem(KEY, '1');
    } catch { /* private browsing — count it rather than skip it */ }
    fetch('/api/public/news/view', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: p.slug }), keepalive: true,
    }).catch(() => { /* a missed count must never disturb the reader */ });
  }, [p?.slug]);

  const shell = (children) => (
    <div className="light-page min-h-screen bg-white" style={{ color: COLORS.charcoal, ...FONT }}>
      <SiteNav />{children}<SiteFooter />
    </div>
  );

  if (p === undefined) return shell(
    <main className="max-w-3xl mx-auto px-5 py-20">
      <div className="h-8 w-2/3 rounded bg-gray-100 animate-pulse" />
      <div className="mt-4 h-4 w-1/3 rounded bg-gray-100 animate-pulse" />
      <div className="mt-8 space-y-3">
        {[0, 1, 2, 3, 4].map(i => <div key={i} className="h-4 rounded bg-gray-100 animate-pulse" />)}
      </div>
    </main>
  );

  if (p === null) return shell(
    <main id="main" className="max-w-3xl mx-auto px-5 py-24 text-center">
      <h1 className="text-2xl font-black" style={{ color: COLORS.green900 }}>Story not found</h1>
      <p className="mt-3 text-sm text-gray-600">
        It may have been withdrawn, or the link may be wrong.
      </p>
      <a href="/media/news" className="mt-5 inline-block text-sm font-bold hover:underline"
        style={{ color: COLORS.green700 }}>← All news</a>
    </main>
  );

  const tone = CATEGORY_TONE[p.category] || CATEGORY_TONE.News;
  const paras = paragraphs(p.body);

  return shell(
    <>
      <header className="relative overflow-hidden" style={{ background: '#063D2B' }}>
        <div aria-hidden="true" className="absolute inset-0 opacity-[.07]"
          style={{
            backgroundImage: 'radial-gradient(circle at 20% 20%, #fff 1px, transparent 1px)',
            backgroundSize: '26px 26px',
          }} />
        <div className="relative max-w-3xl mx-auto px-5 py-12 sm:py-16">
          <a href="/media/news"
            className="inline-flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[.16em]
              hover:underline" style={{ color: COLORS.gold400 }}>
            <ArrowLeft size={13} aria-hidden="true" /> News
          </a>

          <span className="mt-5 inline-block rounded-full px-2.5 py-1 text-[10px] font-black
            uppercase tracking-wider" style={{ background: 'rgba(255,255,255,.14)', color: '#fff' }}>
            {p.category}
          </span>

          <h1 className="mt-3 text-3xl sm:text-[42px] font-black text-white leading-[1.15]">
            {p.title}
          </h1>

          <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-white/60">
            {p.author_name && <span className="font-semibold text-white/80">{p.author_name}</span>}
            <span>{fmtDate(p.publish_at || p.created_at)}</span>
            <span className="inline-flex items-center gap-1">
              <Clock size={11} aria-hidden="true" />{readingMinutes(p.body)} min read
            </span>
            {p.views > 0 && (
              <span className="inline-flex items-center gap-1">
                <Eye size={11} aria-hidden="true" />{p.views.toLocaleString()} reads
              </span>
            )}
          </div>
        </div>
      </header>

      <main id="main" className="max-w-3xl mx-auto px-5 py-10 sm:py-14">
        {p.cover_url && (
          <div className="relative aspect-[16/9] mb-10 overflow-hidden rounded-2xl bg-gray-100">
            <Image src={p.cover_url} alt="" fill sizes="(max-width: 768px) 100vw, 768px"
              className="object-cover" priority />
          </div>
        )}

        {p.summary && (
          <p className="mb-8 text-[17px] leading-relaxed font-semibold border-l-4 pl-4"
            style={{ color: COLORS.green900, borderColor: tone.fg }}>{p.summary}</p>
        )}

        {/* Rendered as text, never as markup — React escapes each paragraph.
            That is why the body is stored plain rather than as HTML. */}
        <div className="space-y-5">
          {paras.map((t, i) => (
            <p key={i} className="text-[16.5px] leading-[1.8] text-gray-700">{t}</p>
          ))}
        </div>

        <div className="mt-10 pt-6 border-t border-gray-200">
          <ShareButtons title={p.title} summary={p.summary} label="Share this story" />
        </div>
      </main>

      {/* ── More stories ── */}
      {more.length > 0 && (
        <section className="border-t border-gray-100 bg-gray-50/60">
          <div className="max-w-tnr-wide mx-auto px-5 py-12">
            <h2 className="text-lg font-black mb-6" style={{ color: COLORS.green900 }}>More from TNR</h2>
            <div className="grid sm:grid-cols-3 gap-6">
              {more.map(n => (
                <a key={n.id} href={`/media/news/${n.slug}`}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white
                    shadow-tnr-flat transition-all duration-standard hover:-translate-y-[3px] hover:shadow-tnr-raise">
                  <div className="relative aspect-[16/9] bg-gray-100">
                    {n.cover_url ? (
                      <Image src={n.cover_url} alt="" fill sizes="(max-width: 640px) 100vw, 33vw"
                        className="object-cover" />
                    ) : (
                      <div className="absolute inset-0 grid place-items-center"
                        style={{ background: `linear-gradient(140deg, ${COLORS.green700}, ${COLORS.green950})` }}>
                        <Newspaper size={22} className="text-white/30" aria-hidden="true" />
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="font-black text-[15px] leading-snug group-hover:underline"
                      style={{ color: COLORS.green900 }}>{n.title}</h3>
                    <p className="mt-1.5 text-[11.5px] text-gray-500">
                      {fmtDate(n.publish_at || n.created_at)}
                    </p>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
