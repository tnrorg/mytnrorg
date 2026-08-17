'use client';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { ArrowRight, PenLine, Clock, Eye, MessageSquare } from 'lucide-react';
import { SectionHeading, Reveal, RevealGroup, RevealItem } from '@/components/ui';
import Avatar from '@/components/ui/Avatar';
import OpinionLike from '@/components/site/OpinionLike';
import ShareButtons from '@/components/site/ShareButtons';
import useLikedSlugs from '@/components/site/useLikedSlugs';
import { COLORS, FONT } from '@/lib/design/tokens';
import { readingMinutes } from '@/lib/opinions';

const fmt = (d) => (d ? new Date(d).toLocaleDateString('en-GB', {
  day: 'numeric', month: 'short', year: 'numeric',
}) : '');

/* The three most recent member Opinions, on the home page.
 *
 * Renders NOTHING until something has been published — the same rule the
 * leadership messages and reach sections follow. An empty "Opinions" heading
 * with a placeholder underneath would advertise a section that has nothing in
 * it, which is worse than not mentioning it yet.
 */
export default function OpinionsPreview() {
  const [rows, setRows] = useState(null);

  useEffect(() => {
    fetch('/api/public/opinions', { cache: 'no-store' })
      .then(r => r.json())
      .then(j => setRows(j?.ok ? (j.opinions || []).slice(0, 3) : []))
      .catch(() => setRows([]));
  }, []);

  // One request for all three cards, not one each.
  // Called before the early return below — a hook cannot be skipped.
  const { liked, known } = useLikedSlugs((rows || []).map(o => o.slug));

  // Still loading, or nothing published: show nothing at all.
  if (!rows?.length) return null;

  return (
    <section className="max-w-tnr-wide mx-auto px-4 pb-16 w-full" style={FONT}>
      <Reveal className="flex flex-wrap items-end justify-between gap-4">
        <SectionHeading eyebrow="In Their Own Words" title="Opinions"
          lead="Members writing on education, leadership, service and the future of Roundu." />
        <a href="/media/opinions"
          className="group inline-flex items-center gap-1.5 rounded-tnr px-5 py-2.5 text-sm font-bold
            transition-colors duration-micro hover:bg-[rgba(23,107,73,.14)]"
          style={{ background: 'rgba(23,107,73,.08)', color: COLORS.green700 }}>
          Read all opinions
          <ArrowRight size={14} strokeWidth={2.5} aria-hidden="true"
            className="transition-transform duration-micro group-hover:translate-x-0.5" />
        </a>
      </Reveal>

      <RevealGroup className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {rows.map(o => (
          <RevealItem key={o.id} className="h-full">
            <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-gray-100
              bg-white shadow-tnr-flat transition-all duration-standard
              hover:-translate-y-[3px] hover:shadow-tnr-raise hover:border-[rgba(23,107,73,.22)]">
              <a href={`/media/opinions/${o.slug}`} className="block">
                {o.published_cover ? (
                  <div className="relative aspect-[16/9] bg-gray-100">
                    <Image src={o.published_cover} alt="" fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="object-cover" />
                  </div>
                ) : (
                  <div className="aspect-[16/9] grid place-items-center"
                    style={{ background: `linear-gradient(140deg, ${COLORS.green700}, ${COLORS.green950})` }}>
                    <PenLine size={28} className="text-white/40" aria-hidden="true" />
                  </div>
                )}
              </a>

              <div className="flex flex-1 flex-col p-5">
                <a href={`/media/opinions/${o.slug}`}>
                  <h3 className="font-black text-[16px] leading-snug group-hover:underline"
                    style={{ color: COLORS.green900 }}>{o.published_title}</h3>
                </a>
                <p className="mt-2 text-[13px] text-gray-600 leading-relaxed line-clamp-2">
                  {o.published_summary}
                </p>

                {/* Byline pinned to the bottom so the three cards line up. */}
                <div className="mt-auto pt-4 flex items-center gap-2.5">
                  <Avatar src={o.author?.photo_url} gender={o.author?.gender}
                    name={o.author?.full_name || 'Member'} className="w-8 h-8 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[12.5px] font-bold truncate" style={{ color: COLORS.green900 }}>
                      {o.author?.full_name || 'TNR Member'}
                    </div>
                    <div className="text-[11px] text-gray-500 flex flex-wrap items-center gap-2">
                      <span>{fmt(o.published_at)}</span>
                      <span className="inline-flex items-center gap-1">
                        <Clock size={10} aria-hidden="true" />
                        {readingMinutes(o.published_body)} min
                      </span>
                      {/* Counts only — never who. */}
                      {o.views > 0 && (
                        <span className="inline-flex items-center gap-1">
                          <Eye size={10} aria-hidden="true" />
                          {o.views.toLocaleString()}
                        </span>
                      )}
                    </div>

                    {/* Like and share without leaving the home page. Comments
                        link into the article, since replying needs the piece
                        in front of you. */}
                    <div className="mt-1 flex items-center gap-1">
                      <OpinionLike compact slug={o.slug} initial={o.likes || 0}
                        initialLiked={known ? liked.has(o.slug) : undefined} />
                      <a href={`/media/opinions/${o.slug}#comments`}
                        aria-label={`${o.comments || 0} comments`} title="Comments"
                        className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px]
                          text-gray-500 hover:text-[#176B49] transition-colors">
                        <MessageSquare size={11} strokeWidth={2.2} aria-hidden="true" />
                        <span className="tabular-nums">{(o.comments || 0).toLocaleString()}</span>
                      </a>
                      <ShareButtons compact title={o.published_title}
                        summary={o.published_summary}
                        path={`/media/opinions/${o.slug}`} />
                    </div>
                  </div>
                </div>
              </div>
            </article>
          </RevealItem>
        ))}
      </RevealGroup>
    </section>
  );
}
