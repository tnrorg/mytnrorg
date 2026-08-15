'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import { ArrowLeft, Clock, Eye } from 'lucide-react';
import SiteNav from '@/components/site/SiteNav';
import SiteFooter from '@/components/site/SiteFooter';
import Avatar from '@/components/ui/Avatar';
import OpinionViewTracker from '@/components/site/OpinionViewTracker';
import OpinionLike from '@/components/site/OpinionLike';
import ShareButtons from '@/components/site/ShareButtons';
import OpinionComments from '@/components/site/OpinionComments';
import { COLORS, FONT } from '@/lib/design/tokens';
import { paragraphs, readingMinutes } from '@/lib/opinions';

const fmt = (d) => (d ? new Date(d).toLocaleDateString('en-GB', {
  day: 'numeric', month: 'long', year: 'numeric',
}) : '');

export default function OpinionArticle() {
  const { slug } = useParams();
  const [o, setO] = useState(undefined);   // undefined = loading, null = not found

  useEffect(() => {
    let off = false;
    fetch(`/api/public/opinions?slug=${encodeURIComponent(slug)}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(j => { if (!off) setO(j?.ok && j.opinions?.[0] ? j.opinions[0] : null); })
      .catch(() => { if (!off) setO(null); });
    return () => { off = true; };
  }, [slug]);

  const shell = (children) => (
    <div className="light-page min-h-screen bg-white" style={{ color: COLORS.charcoal, ...FONT }}>
      <SiteNav />
      {children}
      <SiteFooter />
    </div>
  );

  if (o === undefined) return shell(
    <main className="max-w-3xl mx-auto px-5 py-20">
      <div className="h-8 w-2/3 rounded bg-gray-100 animate-pulse" />
      <div className="mt-4 h-4 w-1/3 rounded bg-gray-100 animate-pulse" />
      <div className="mt-8 space-y-3">
        {[0, 1, 2, 3, 4].map(i => <div key={i} className="h-4 rounded bg-gray-100 animate-pulse" />)}
      </div>
    </main>
  );

  if (o === null) return shell(
    <main id="main" className="max-w-3xl mx-auto px-5 py-24 text-center">
      <h1 className="text-2xl font-black" style={{ color: COLORS.green900 }}>Opinion not found</h1>
      <p className="mt-3 text-sm text-gray-600">
        It may have been withdrawn, or the link may be wrong.
      </p>
      <a href="/media/opinions" className="mt-5 inline-block text-sm font-bold hover:underline"
        style={{ color: COLORS.green700 }}>← All opinions</a>
    </main>
  );

  const paras = paragraphs(o.published_body);

  return shell(
    <>
      {/* Renders nothing. Counts one read per browser session. */}
      <OpinionViewTracker slug={o.slug} />
      <header className="relative overflow-hidden" style={{ background: '#063D2B' }}>
        <div aria-hidden="true" className="absolute inset-0 opacity-[.07]"
          style={{
            backgroundImage: 'radial-gradient(circle at 20% 20%, #fff 1px, transparent 1px)',
            backgroundSize: '26px 26px',
          }} />
        <div className="relative max-w-3xl mx-auto px-5 py-12 sm:py-16">
          <a href="/media/opinions"
            className="inline-flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[.16em]
              hover:underline" style={{ color: COLORS.gold400 }}>
            <ArrowLeft size={13} aria-hidden="true" /> Opinions
          </a>
          <h1 className="mt-4 text-3xl sm:text-[42px] font-black text-white leading-[1.15]">
            {o.published_title}
          </h1>

          <div className="mt-6 flex items-center gap-3">
            <Avatar src={o.author?.photo_url} gender={o.author?.gender}
              name={o.author?.full_name || 'Member'}
              className="w-11 h-11 shrink-0 ring-2 ring-[#D4A72C]" />
            <div className="min-w-0">
              <div className="font-bold text-white text-[15px] truncate">
                {o.author?.full_name || 'TNR Member'}
              </div>
              <div className="text-[12px] text-white/60 flex flex-wrap items-center gap-x-2">
                {o.author?.current_position && <span>{o.author.current_position}</span>}
                <span>{fmt(o.published_at)}</span>
                <span className="inline-flex items-center gap-1">
                  <Clock size={11} aria-hidden="true" />
                  {readingMinutes(o.published_body)} min read
                </span>
                {/* Shown once someone has actually read it. "0 reads" under a
                    newly published piece reads as a verdict on it. */}
                {o.views > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <Eye size={11} aria-hidden="true" />
                    {o.views.toLocaleString()} {o.views === 1 ? 'read' : 'reads'}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main id="main" className="max-w-3xl mx-auto px-5 py-10 sm:py-14">
        {o.published_cover && (
          <div className="relative aspect-[16/9] mb-10 overflow-hidden rounded-2xl bg-gray-100">
            <Image src={o.published_cover} alt="" fill sizes="(max-width: 768px) 100vw, 768px"
              className="object-cover" priority />
          </div>
        )}

        {o.published_summary && (
          <p className="mb-8 text-[17px] leading-relaxed font-semibold"
            style={{ color: COLORS.green900 }}>{o.published_summary}</p>
        )}

        {/* Rendered as text, never as markup.
            The body is stored plain and split on blank lines, so nothing an
            author types can become HTML on a public page. React escapes these
            strings; that is the whole protection and it is why the format is
            plain text rather than a rich editor. */}
        <div className="space-y-5">
          {paras.map((p, i) => (
            <p key={i} className="text-[16.5px] leading-[1.8] text-gray-700">{p}</p>
          ))}
        </div>

        {/* Offered at the END of the article, not the top: a like should mean
            "I read this", and a button above the text invites the other thing. */}
        <div className="mt-10 pt-6 border-t border-gray-200 space-y-5">
          <OpinionLike slug={o.slug} initial={o.likes || 0} />
          <ShareButtons title={o.published_title} summary={o.published_summary} />
        </div>

        <div className="mt-8 rounded-2xl border border-gray-200 bg-gray-50 p-5 text-[13px] text-gray-600 leading-relaxed">
          <span className="font-bold" style={{ color: COLORS.green900 }}>A member&rsquo;s view. </span>
          Opinions are written by individual TNR members and published after review.
          They express the writer&rsquo;s own views, not a position of Tehreek-e-Nojawanan Roundu.
          {o.author?.membership_id && (
            <> <a href={`/members/${o.author.membership_id}`} className="font-bold hover:underline"
              style={{ color: COLORS.green700 }}>See {o.author.full_name}&rsquo;s profile →</a></>
          )}
        </div>

        {/* After the disclaimer, so a reader has seen whose view this is
            before responding to it. */}
        <OpinionComments slug={o.slug} />
      </main>
    </>
  );
}
