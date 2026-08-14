'use client';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { PenLine, Clock, Eye } from 'lucide-react';
import SiteNav from '@/components/site/SiteNav';
import SiteFooter from '@/components/site/SiteFooter';
import Avatar from '@/components/ui/Avatar';
import { COLORS, FONT } from '@/lib/design/tokens';
import { readingMinutes } from '@/lib/opinions';

const fmt = (d) => (d ? new Date(d).toLocaleDateString('en-GB', {
  day: 'numeric', month: 'long', year: 'numeric',
}) : '');

/* Published member Opinions.
 *
 * Every piece here was written by a member and approved by the committee.
 * The byline is deliberately prominent — the point of the section is that
 * these are individual voices from Roundu, not the organisation speaking.
 */
export default function OpinionsIndex() {
  const [rows, setRows] = useState(null);   // null = loading

  useEffect(() => {
    fetch('/api/public/opinions', { cache: 'no-store' })
      .then(r => r.json())
      .then(j => setRows(j?.ok ? (j.opinions || []) : []))
      .catch(() => setRows([]));
  }, []);

  return (
    <div className="light-page min-h-screen bg-white" style={{ color: COLORS.charcoal, ...FONT }}>
      <SiteNav />

      <header className="relative overflow-hidden" style={{ background: '#063D2B' }}>
        <div aria-hidden="true" className="absolute inset-0 opacity-[.07]"
          style={{
            backgroundImage: 'radial-gradient(circle at 20% 20%, #fff 1px, transparent 1px)',
            backgroundSize: '26px 26px',
          }} />
        <div className="relative max-w-5xl mx-auto px-5 py-14 sm:py-20">
          <div className="text-[11px] font-bold uppercase tracking-[.28em] mb-3"
            style={{ color: COLORS.gold400 }}>Media</div>
          <h1 className="text-3xl sm:text-5xl font-black text-white leading-tight">Opinions</h1>
          <p className="mt-4 text-white/80 text-base sm:text-lg max-w-2xl leading-relaxed">
            Views from TNR members on education, leadership, service and the future of Roundu.
            Each piece is the writer&rsquo;s own.
          </p>
        </div>
      </header>

      <main id="main" className="max-w-5xl mx-auto px-5 py-12 sm:py-16">
        {rows === null && (
          <div className="grid sm:grid-cols-2 gap-6">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="h-64 rounded-2xl border border-gray-100 bg-gray-50 animate-pulse" />
            ))}
          </div>
        )}

        {rows !== null && !rows.length && (
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-10 text-center">
            <PenLine size={30} className="mx-auto mb-3" style={{ color: COLORS.green700 }} aria-hidden="true" />
            <h2 className="font-black text-lg" style={{ color: COLORS.green900 }}>No opinions published yet</h2>
            <p className="mt-2 text-sm text-gray-600 max-w-md mx-auto leading-relaxed">
              Members can write and submit an opinion from their portal. Approved pieces appear here.
            </p>
            <a href="/member/opinions"
              className="mt-4 inline-block text-sm font-bold hover:underline" style={{ color: COLORS.green700 }}>
              Write one →
            </a>
          </div>
        )}

        {rows !== null && rows.length > 0 && (
          <div className="grid sm:grid-cols-2 gap-6">
            {rows.map(o => (
              <article key={o.id}
                className="group flex h-full flex-col overflow-hidden rounded-2xl border border-gray-100
                  bg-white shadow-tnr-flat transition-all duration-standard
                  hover:-translate-y-[3px] hover:shadow-tnr-raise hover:border-[rgba(23,107,73,.22)]">
                <a href={`/media/opinions/${o.slug}`} className="block">
                  {o.published_cover ? (
                    <div className="relative aspect-[16/9] bg-gray-100">
                      <Image src={o.published_cover} alt="" fill
                        sizes="(max-width: 640px) 100vw, 50vw"
                        className="object-cover" />
                    </div>
                  ) : (
                    <div className="aspect-[16/9] grid place-items-center"
                      style={{ background: `linear-gradient(140deg, ${COLORS.green700}, ${COLORS.green950})` }}>
                      <PenLine size={30} className="text-white/40" aria-hidden="true" />
                    </div>
                  )}
                </a>

                <div className="flex flex-1 flex-col p-5">
                  <a href={`/media/opinions/${o.slug}`}>
                    <h2 className="font-black text-[17px] leading-snug group-hover:underline"
                      style={{ color: COLORS.green900 }}>{o.published_title}</h2>
                  </a>
                  <p className="mt-2 text-[13.5px] text-gray-600 leading-relaxed line-clamp-3">
                    {o.published_summary}
                  </p>

                  {/* Byline pinned to the bottom so cards in a row line up. */}
                  <div className="mt-auto pt-4 flex items-center gap-2.5">
                    <Avatar src={o.author?.photo_url} gender={o.author?.gender}
                      name={o.author?.full_name || 'Member'} className="w-8 h-8 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-[12.5px] font-bold truncate" style={{ color: COLORS.green900 }}>
                        {o.author?.full_name || 'TNR Member'}
                      </div>
                      <div className="text-[11px] text-gray-500 flex items-center gap-2">
                        <span>{fmt(o.published_at)}</span>
                        <span className="inline-flex items-center gap-1">
                          <Clock size={10} aria-hidden="true" />
                          {readingMinutes(o.published_body)} min
                        </span>
                        {/* Only once someone has actually read it. "0 views"
                            under a new piece reads as a verdict on it. */}
                        {o.views > 0 && (
                          <span className="inline-flex items-center gap-1">
                            <Eye size={10} aria-hidden="true" />
                            {o.views.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
