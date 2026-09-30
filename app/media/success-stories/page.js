'use client';
import { useCallback, useEffect, useState } from 'react';
import SiteNav from '@/components/site/SiteNav';
import SiteFooter from '@/components/site/SiteFooter';
import { COLORS, FONT } from '@/lib/design/tokens';
import {
  KINDS, kindIcon, kindLabel, achievedLabel, initialsOf,
} from '@/lib/successStories';

const C = {
  deep: COLORS.green900, green: COLORS.green700, gold: COLORS.gold500,
  ink: COLORS.charcoal,
};

/* TNR Success Stories — the public page.
 *
 * Every card here was submitted by the member it is about and approved by an
 * office bearer. Nothing reaches this page any other way: the API pins status
 * to 'published' rather than reading it from the URL.
 */
export default function SuccessStoriesPage() {
  const [kind, setKind] = useState('');
  const [d, setD] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback((k) => {
    setLoading(true);
    fetch(`/api/public/success-stories${k ? `?kind=${k}` : ''}`)
      .then(r => r.json())
      .then(j => setD(j?.ok ? j : { stories: [], authors: {}, counts: {} }))
      .catch(() => setD({ stories: [], authors: {}, counts: {} }))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(kind); }, [load, kind]);

  const stories = d?.stories || [];
  const authors = d?.authors || {};
  const counts = d?.counts || {};

  /* Only categories that actually have a published story get a chip. A filter
   * that leads to an empty page is a filter that makes the site look broken. */
  const chips = KINDS.filter(k => counts[k.key] || kind === k.key);

  return (
    <div className="light-page min-h-screen bg-white" style={{ color: C.ink, ...FONT }}>
      <SiteNav />

      {/* ── Header ── */}
      <header className="relative overflow-hidden">
        <div aria-hidden
          style={{
            position: 'absolute', inset: 0,
            background: 'radial-gradient(900px 400px at 50% -20%, rgba(11,107,79,.14), transparent 70%)',
          }} />
        <div className="relative mx-auto max-w-6xl px-4 pb-8 pt-14 text-center sm:pt-20">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-[.24em]" style={{ color: C.gold }}>
            Media
          </div>
          <h1 className="text-[30px] font-black leading-tight sm:text-[40px]" style={{ color: C.deep }}>
            TNR Success Stories
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-[15px] leading-relaxed" style={{ color: '#4A554E' }}>
            Degrees earned, jobs secured, certificates completed, competitions won.
            The achievements of Tehreek-e-Nojawanan Roundu members — shared by
            them, in their own words.
          </p>
        </div>
      </header>

      {/* ── Category filter ── */}
      {chips.length > 1 && (
        <div className="mx-auto mb-8 max-w-6xl px-4">
          <div className="flex flex-wrap justify-center gap-2">
            <Chip on={!kind} onClick={() => setKind('')}>All</Chip>
            {chips.map(k => (
              <Chip key={k.key} on={kind === k.key} onClick={() => setKind(k.key)}>
                {k.icon} {k.label}{counts[k.key] ? ` (${counts[k.key]})` : ''}
              </Chip>
            ))}
          </div>
        </div>
      )}

      {/* ── The cards ── */}
      <main className="mx-auto max-w-6xl px-4 pb-20">
        {loading && (
          <p className="py-10 text-center text-[14px]" style={{ color: '#6B7280' }}>Loading…</p>
        )}

        {!loading && !stories.length && (
          <div className="mx-auto max-w-lg rounded-2xl border px-6 py-10 text-center"
            style={{ borderColor: '#E7EAE8', background: '#FAFBFA' }}>
            <p className="text-[15px] font-bold" style={{ color: C.deep }}>
              No stories published yet
            </p>
            <p className="mt-2 text-[13.5px] leading-relaxed" style={{ color: '#6B7280' }}>
              TNR members can share their achievements from the member portal.
              Approved stories appear here.
            </p>
            <a href="/member/success-stories"
              className="mt-4 inline-block rounded-xl px-5 py-2.5 text-[14px] font-bold text-white"
              style={{ background: C.green }}>
              Share your achievement
            </a>
          </div>
        )}

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {stories.map(s => (
            <StoryCard key={s.id} story={s} author={authors[s.id]} />
          ))}
        </div>

        {!loading && !!stories.length && (
          <div className="mt-12 rounded-2xl border px-6 py-8 text-center"
            style={{ borderColor: 'rgba(11,107,79,.2)', background: 'linear-gradient(135deg,#F4FAF7,#FFFFFF)' }}>
            <p className="text-[17px] font-black" style={{ color: C.deep }}>
              Achieved something?
            </p>
            <p className="mx-auto mt-1.5 max-w-lg text-[13.5px] leading-relaxed" style={{ color: '#4A554E' }}>
              TNR members can share a degree, a job, a certificate or an award
              from the member portal. It appears here once an office bearer
              approves it.
            </p>
            <a href="/member/success-stories"
              className="mt-4 inline-block rounded-xl px-5 py-2.5 text-[14px] font-bold text-white"
              style={{ background: C.green }}>
              Share yours
            </a>
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}

function Chip({ children, on, onClick }) {
  return (
    <button type="button" onClick={onClick}
      className="rounded-full px-3.5 py-1.5 text-[12.5px] font-bold transition-colors"
      style={on
        ? { background: C.green, color: '#fff' }
        : { background: '#F1F4F2', color: '#4A554E' }}>
      {children}
    </button>
  );
}

/* The premium card.
 *
 * WHAT MAKES IT READ AS PREMIUM, deliberately rather than by accident:
 *   • a deep green band at the top carrying the category, so a wall of cards
 *     has rhythm instead of being a grid of white rectangles;
 *   • the photograph overlapping that band, ringed in white — the single
 *     detail that makes a card look made rather than generated;
 *   • a gold rule under the title, the same gold as the rest of the site;
 *   • generous space around the description, because the words are the point.
 *
 * The person, not the achievement, is the subject: the photograph and the
 * name come first, and the category is a label above them.
 */
function StoryCard({ story, author }) {
  const name = author?.name || 'TNR Member';
  const featured = !!story.featured;

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl bg-white transition-shadow duration-300"
      style={{
        boxShadow: featured
          ? `0 0 0 1.5px ${C.gold}, 0 10px 34px rgba(6,61,43,.13)`
          : '0 0 0 1px #E7EAE8, 0 6px 22px rgba(6,61,43,.07)',
      }}>

      {/* Band */}
      <div className="relative px-5 pb-10 pt-4"
        style={{ background: `linear-gradient(135deg, ${C.deep}, ${C.green})` }}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10.5px] font-black uppercase tracking-[.18em]"
            style={{ color: 'rgba(255,255,255,.82)' }}>
            {kindIcon(story.kind)} {kindLabel(story.kind)}
          </span>
          {featured && (
            <span className="rounded-full px-2 py-0.5 text-[9.5px] font-black uppercase tracking-wider"
              style={{ background: C.gold, color: '#3A2D05' }}>
              Featured
            </span>
          )}
        </div>
      </div>

      {/* Photograph, overlapping the band */}
      <div className="-mt-8 px-5">
        {author?.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={author.photo} alt={name}
            className="h-16 w-16 rounded-full object-cover"
            style={{ boxShadow: '0 0 0 3.5px #fff, 0 4px 14px rgba(0,0,0,.18)' }} />
        ) : (
          <span className="grid h-16 w-16 place-items-center rounded-full text-[19px] font-black text-white"
            style={{
              background: 'linear-gradient(150deg,#0F6B4E,#083527)',
              boxShadow: '0 0 0 3.5px #fff, 0 4px 14px rgba(0,0,0,.18)',
            }}>
            {initialsOf(name)}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col px-5 pb-5 pt-3">
        <h3 className="text-[15.5px] font-black leading-snug" style={{ color: C.deep }}>
          {name}
        </h3>
        {author?.union_council && (
          <p className="mt-0.5 text-[11.5px] font-semibold uppercase tracking-wide"
            style={{ color: '#8A9590' }}>
            {author.union_council}
          </p>
        )}

        <span aria-hidden className="mt-3 block h-[2.5px] w-9 rounded-full"
          style={{ background: C.gold }} />

        <p className="mt-3 text-[14.5px] font-bold leading-snug" style={{ color: C.ink }}>
          {story.title}
        </p>
        {(story.organisation || story.achieved_on) && (
          <p className="mt-1 text-[12.5px]" style={{ color: '#6B7280' }}>
            {story.organisation}
            {story.organisation && story.achieved_on ? ' · ' : ''}
            {achievedLabel(story.achieved_on)}
          </p>
        )}

        <p className="mt-3 flex-1 whitespace-pre-wrap text-[13.5px] leading-relaxed"
          style={{ color: '#4A554E' }}>
          {story.description}
        </p>

        {story.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={story.image_url} alt=""
            className="mt-4 h-40 w-full rounded-xl object-cover"
            style={{ boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.06)' }} />
        )}
      </div>
    </article>
  );
}
