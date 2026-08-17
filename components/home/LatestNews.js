'use client';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { ArrowRight, Newspaper, Clock } from 'lucide-react';
import { SectionHeading, Reveal, RevealGroup, RevealItem } from '@/components/ui';
import { COLORS, FONT } from '@/lib/design/tokens';
import { CATEGORY_TONE, readingMinutes, fmtDate } from '@/lib/news';

/* Latest news on the home page.
 *
 * One lead story beside two smaller ones, rather than three equal cards. The
 * committee usually has one thing it most wants read, and a row of identical
 * tiles gives it no way to say so.
 *
 * Renders NOTHING until something is published — the same rule the leadership
 * messages and Opinions sections follow. A heading with an empty box under it
 * advertises a section the site does not have yet.
 */
export default function LatestNews() {
  const [rows, setRows] = useState(null);

  useEffect(() => {
    fetch('/api/public/news?limit=3', { cache: 'no-store' })
      .then(r => r.json())
      .then(j => setRows(j?.ok ? (j.posts || []) : []))
      .catch(() => setRows([]));
  }, []);

  if (!rows?.length) return null;
  const [lead, ...rest] = rows;

  return (
    <section className="max-w-tnr-wide mx-auto px-4 pb-16 w-full" style={FONT}>
      <Reveal className="flex flex-wrap items-end justify-between gap-4">
        <SectionHeading eyebrow="From the Committee" title="News & Announcements"
          lead="Programmes, decisions, events and achievements from across Roundu." />
        <a href="/media/news"
          className="group inline-flex items-center gap-1.5 rounded-tnr px-5 py-2.5 text-sm font-bold
            transition-colors duration-micro hover:bg-[rgba(23,107,73,.14)]"
          style={{ background: 'rgba(23,107,73,.08)', color: COLORS.green700 }}>
          All news
          <ArrowRight size={14} strokeWidth={2.5} aria-hidden="true"
            className="transition-transform duration-micro group-hover:translate-x-0.5" />
        </a>
      </Reveal>

      <RevealGroup className="mt-10 grid lg:grid-cols-2 gap-6">
        {/* Lead */}
        <RevealItem>
          <a href={`/media/news/${lead.slug}`}
            className="group flex h-full flex-col overflow-hidden rounded-2xl border border-gray-100
              bg-white shadow-tnr-flat transition-all duration-standard
              hover:-translate-y-[3px] hover:shadow-tnr-raise hover:border-[rgba(23,107,73,.22)]">
            <Cover p={lead} big />
            <div className="p-6 flex flex-1 flex-col">
              <Tag c={lead.category} />
              <h3 className="mt-2.5 font-black text-[21px] leading-snug group-hover:underline"
                style={{ color: COLORS.green900 }}>{lead.title}</h3>
              <p className="mt-2 text-[14px] text-gray-600 leading-relaxed line-clamp-3">
                {lead.summary}
              </p>
              <Meta p={lead} className="mt-auto pt-4" />
            </div>
          </a>
        </RevealItem>

        {/* Two beside it, stacked */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-1 gap-6">
          {rest.map(p => (
            <RevealItem key={p.id}>
              <a href={`/media/news/${p.slug}`}
                className="group flex h-full gap-4 overflow-hidden rounded-2xl border border-gray-100
                  bg-white p-4 shadow-tnr-flat transition-all duration-standard
                  hover:-translate-y-[3px] hover:shadow-tnr-raise hover:border-[rgba(23,107,73,.22)]">
                <div className="relative w-28 sm:w-32 shrink-0 aspect-[4/3] overflow-hidden rounded-xl bg-gray-100">
                  {p.cover_url ? (
                    <Image src={p.cover_url} alt="" fill sizes="128px" className="object-cover" />
                  ) : (
                    <div className="absolute inset-0 grid place-items-center"
                      style={{ background: `linear-gradient(140deg, ${COLORS.green700}, ${COLORS.green950})` }}>
                      <Newspaper size={20} className="text-white/30" aria-hidden="true" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex flex-col">
                  <Tag c={p.category} />
                  <h3 className="mt-1.5 font-black text-[15px] leading-snug group-hover:underline line-clamp-2"
                    style={{ color: COLORS.green900 }}>{p.title}</h3>
                  <Meta p={p} className="mt-auto pt-2" />
                </div>
              </a>
            </RevealItem>
          ))}
        </div>
      </RevealGroup>
    </section>
  );
}

function Cover({ p, big }) {
  if (p.cover_url) return (
    <div className={`relative ${big ? 'aspect-[16/9]' : 'aspect-[4/3]'} bg-gray-100`}>
      <Image src={p.cover_url} alt="" fill
        sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" />
    </div>
  );
  return (
    <div className={`${big ? 'aspect-[16/9]' : 'aspect-[4/3]'} grid place-items-center`}
      style={{ background: `linear-gradient(140deg, ${COLORS.green700}, ${COLORS.green950})` }}>
      <Newspaper size={32} className="text-white/30" aria-hidden="true" />
    </div>
  );
}

function Tag({ c }) {
  const t = CATEGORY_TONE[c] || CATEGORY_TONE.News;
  return (
    <span className="inline-block w-fit rounded-full px-2 py-0.5 text-[9.5px] font-black uppercase tracking-wider"
      style={{ background: t.bg, color: t.fg }}>{c}</span>
  );
}

function Meta({ p, className = '' }) {
  return (
    <div className={`flex flex-wrap items-center gap-x-2.5 text-[11px] text-gray-500 ${className}`}>
      <span>{fmtDate(p.publish_at || p.created_at)}</span>
      <span className="inline-flex items-center gap-1">
        <Clock size={10} aria-hidden="true" />{readingMinutes(p.body)} min
      </span>
    </div>
  );
}
