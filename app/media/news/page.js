'use client';
import { useCallback, useEffect, useState } from 'react';
import useRefreshOnFocus from '@/components/site/useRefreshOnFocus';
import Image from 'next/image';
import { Newspaper, Clock, Eye, ArrowRight } from 'lucide-react';
import SiteNav from '@/components/site/SiteNav';
import SiteFooter from '@/components/site/SiteFooter';
import { COLORS, FONT } from '@/lib/design/tokens';
import { CATEGORIES, CATEGORY_TONE, readingMinutes, fmtDate } from '@/lib/news';

/* News & Announcements index.
 *
 * The newest piece leads at full width, the rest follow in a grid. A page of
 * identical cards makes every story equally important, which is the same as
 * making none of them important — a newspaper has a front page for a reason.
 */
export default function NewsIndex() {
  const [rows, setRows] = useState(null);      // null = loading
  const [cat, setCat] = useState('');
  const [why, setWhy] = useState(null);        // server's explanation of an empty list

  const load = useCallback(() => {
    fetch(`/api/public/news${cat ? `?category=${encodeURIComponent(cat)}` : ''}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(j => { setRows(j?.ok ? (j.posts || []) : []); setWhy(j?.why || null); })
      .catch(() => { setRows([]); setWhy({ stage: 'network' }); });
  }, [cat]);

  useEffect(() => { setRows(null); load(); }, [load]);

  // Coming back to this tab re-reads the list — see the hook for why a
  // no-store fetch is not enough on its own.
  useRefreshOnFocus(load);

  const [lead, ...rest] = rows || [];

  return (
    <div className="light-page min-h-screen bg-white" style={{ color: COLORS.charcoal, ...FONT }}>
      <SiteNav />

      <header className="relative overflow-hidden" style={{ background: '#063D2B' }}>
        <div aria-hidden="true" className="absolute inset-0 opacity-[.07]"
          style={{
            backgroundImage: 'radial-gradient(circle at 20% 20%, #fff 1px, transparent 1px)',
            backgroundSize: '26px 26px',
          }} />
        <div className="relative max-w-tnr-wide mx-auto px-5 py-14 sm:py-20">
          <div className="text-[11px] font-bold uppercase tracking-[.28em] mb-3"
            style={{ color: COLORS.gold400 }}>Media</div>
          <h1 className="text-3xl sm:text-5xl font-black text-white leading-tight">
            News &amp; Announcements
          </h1>
          <p className="mt-4 text-white/80 text-base sm:text-lg max-w-2xl leading-relaxed">
            Official updates from Tehreek-e-Nojawanan Roundu — programmes, decisions,
            events and achievements from across the community.
          </p>
        </div>
      </header>

      <main id="main" className="max-w-tnr-wide mx-auto px-5 py-12 sm:py-16">
        {/* Category filter */}
        <div className="flex flex-wrap gap-2 mb-10">
          <Chip on={!cat} onClick={() => setCat('')}>All</Chip>
          {CATEGORIES.map(c => (
            <Chip key={c} on={cat === c} onClick={() => setCat(c)} tone={CATEGORY_TONE[c]}>{c}</Chip>
          ))}
        </div>

        {rows === null && (
          <div className="space-y-8">
            <div className="h-72 rounded-3xl bg-gray-50 animate-pulse" />
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[0, 1, 2].map(i => <div key={i} className="h-64 rounded-2xl bg-gray-50 animate-pulse" />)}
            </div>
          </div>
        )}

        {rows !== null && !rows.length && (
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-12 text-center">
            <Newspaper size={30} className="mx-auto mb-3" style={{ color: COLORS.green700 }} aria-hidden="true" />
            <h2 className="font-black text-lg" style={{ color: COLORS.green900 }}>
              {cat ? `Nothing under ${cat} yet` : 'No news published yet'}
            </h2>
            <p className="mt-2 text-sm text-gray-600 max-w-md mx-auto leading-relaxed">
              {cat ? 'Try another category — there may be posts elsewhere.'
                : 'Updates from the committee will appear here.'}
            </p>

            {/* Shown only when posts EXIST but were filtered out. A visitor to
                a site with genuinely no news sees nothing extra; an admin
                wondering why their published post is missing gets the answer
                instead of an empty page that could mean anything. */}
            {why?.rows_from_query > 0 && (
              <p className="mt-4 text-[12px] text-amber-700 max-w-md mx-auto leading-relaxed">
                {why.scheduled_ahead > 0
                  ? `${why.scheduled_ahead} post(s) are scheduled for a later date and will appear then.`
                  : why.already_expired > 0
                    ? `${why.already_expired} post(s) have passed their "hide after" date.`
                    : `${why.rows_from_query} post(s) exist but are outside their publish window.`}
              </p>
            )}
          </div>
        )}

        {/* ── Lead story ── */}
        {lead && (
          <a href={`/media/news/${lead.slug}`}
            className="group block overflow-hidden rounded-3xl border border-gray-100 bg-white
              shadow-tnr-flat transition-all duration-standard hover:shadow-tnr-raise
              hover:border-[rgba(23,107,73,.22)]">
            <div className="grid md:grid-cols-2">
              <div className="relative aspect-[16/10] md:aspect-auto md:min-h-[340px] bg-gray-100">
                {lead.cover_url ? (
                  <Image src={lead.cover_url} alt="" fill priority
                    sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" />
                ) : (
                  <div className="absolute inset-0 grid place-items-center"
                    style={{ background: `linear-gradient(140deg, ${COLORS.green700}, ${COLORS.green950})` }}>
                    <Newspaper size={42} className="text-white/30" aria-hidden="true" />
                  </div>
                )}
                {lead.pinned && (
                  <span className="absolute top-4 left-4 rounded-full px-2.5 py-1 text-[10px] font-black
                    uppercase tracking-wider text-white" style={{ background: COLORS.gold400, color: '#3B2A00' }}>
                    Featured
                  </span>
                )}
              </div>

              <div className="p-7 sm:p-9 flex flex-col justify-center">
                <Tag c={lead.category} />
                <h2 className="mt-3 text-2xl sm:text-[30px] font-black leading-[1.2]
                  group-hover:underline" style={{ color: COLORS.green900 }}>
                  {lead.title}
                </h2>
                <p className="mt-3 text-[15px] text-gray-600 leading-relaxed line-clamp-3">
                  {lead.summary}
                </p>
                <Meta p={lead} className="mt-5" />
                <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold"
                  style={{ color: COLORS.green700 }}>
                  Read the full story
                  <ArrowRight size={14} strokeWidth={2.5} aria-hidden="true"
                    className="transition-transform duration-micro group-hover:translate-x-0.5" />
                </span>
              </div>
            </div>
          </a>
        )}

        {/* ── The rest ── */}
        {rest.length > 0 && (
          <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {rest.map(p => (
              <a key={p.id} href={`/media/news/${p.slug}`}
                className="group flex h-full flex-col overflow-hidden rounded-2xl border border-gray-100
                  bg-white shadow-tnr-flat transition-all duration-standard
                  hover:-translate-y-[3px] hover:shadow-tnr-raise hover:border-[rgba(23,107,73,.22)]">
                <div className="relative aspect-[16/9] bg-gray-100">
                  {p.cover_url ? (
                    <Image src={p.cover_url} alt="" fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="object-cover" />
                  ) : (
                    <div className="absolute inset-0 grid place-items-center"
                      style={{ background: `linear-gradient(140deg, ${COLORS.green700}, ${COLORS.green950})` }}>
                      <Newspaper size={26} className="text-white/30" aria-hidden="true" />
                    </div>
                  )}
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <Tag c={p.category} />
                  <h3 className="mt-2 font-black text-[17px] leading-snug group-hover:underline"
                    style={{ color: COLORS.green900 }}>{p.title}</h3>
                  <p className="mt-2 text-[13.5px] text-gray-600 leading-relaxed line-clamp-2">
                    {p.summary}
                  </p>
                  <Meta p={p} className="mt-auto pt-4" />
                </div>
              </a>
            ))}
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}

function Chip({ on, onClick, tone, children }) {
  return (
    <button onClick={onClick}
      className={`rounded-full px-4 py-2 text-[13px] font-bold transition-colors duration-micro
        ${on ? 'text-white' : 'text-gray-600 bg-gray-100 hover:bg-gray-200'}`}
      style={on ? { background: tone?.fg || COLORS.green700 } : undefined}>
      {children}
    </button>
  );
}

function Tag({ c }) {
  const t = CATEGORY_TONE[c] || CATEGORY_TONE.News;
  return (
    <span className="inline-block w-fit rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider"
      style={{ background: t.bg, color: t.fg }}>{c}</span>
  );
}

function Meta({ p, className = '' }) {
  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-gray-500 ${className}`}>
      <span>{fmtDate(p.publish_at || p.created_at)}</span>
      <span className="inline-flex items-center gap-1">
        <Clock size={11} aria-hidden="true" />{readingMinutes(p.body)} min
      </span>
      {p.views > 0 && (
        <span className="inline-flex items-center gap-1">
          <Eye size={11} aria-hidden="true" />{p.views.toLocaleString()}
        </span>
      )}
    </div>
  );
}
