'use client';
import ExecutiveCard from '@/components/site/ExecutiveCard';
import { CEC_INTRO } from '@/content/executiveCommittee';
import { useLeadership } from '@/components/site/useLeadership';
import { Reveal } from '@/components/ui';

const C = { deep: '#063D2B', gold: '#D4A72C' };
const mont = { fontFamily: 'var(--font-mulish), Mulish, system-ui, sans-serif' };

/* Central Executive Committee roster.
 *
 * Lifted out of app/page.js so that page could become a server component. It
 * was the only thing on the home page calling a hook, and that single hook was
 * forcing the whole page — including the hero — to render on the client. The
 * hero image could not begin downloading until React had hydrated, which was
 * most of a 3.7s LCP. Everything else the page renders was already a client
 * component in its own file and needed no change.
 */
export default function ExecutiveCommittee() {
  const { executive, loading } = useLeadership();
  return (
    <section className="max-w-[1400px] mx-auto px-4 py-14 w-full">
      <Reveal className="flex items-center justify-center gap-3">
        <span className="h-px w-10 sm:w-20" style={{ background: `${C.gold}66` }} />
        <h2 style={{ ...mont, color: C.deep }} className="text-lg sm:text-xl font-black uppercase tracking-wide text-center">Central Executive Committee</h2>
        <span className="h-px w-10 sm:w-20" style={{ background: `${C.gold}66` }} />
      </Reveal>
      <Reveal delay={0.06}>
        <p className="mt-3 text-center text-sm text-gray-600 max-w-3xl mx-auto leading-relaxed">{CEC_INTRO}</p>
      </Reveal>

      {/* One per row on mobile, three per row from desktop up. RevealGroup
          staggers the cards so the grid builds rather than snapping in.

          `key` on the count is load-bearing, not cosmetic. Leadership arrives
          asynchronously, so the viewport observer can fire while this grid is
          still empty. RevealGroup only animates once — cards mounting after
          that would stay at the variant's opacity: 0 and the whole section
          would render as blank space. Re-keying remounts the group when the
          data lands, so the reveal runs against the real cards. */}
      {/* While the roster is in flight, show placeholder panels rather than the
          built-in "To Be Announced" cards. Rendering those and swapping them
          for real names a moment later reads as the page glitching — and if
          the request is slow, a visitor can screenshot office bearers who look
          unfilled when they are not. */}
      {loading ? (
        /* 2 / 3 / 4 across, matching the Advisory Council and the Ambassadors
           so the three leadership rosters read as one set rather than three
           separately-built grids. Four skeletons, not three, because that is
           what a full desktop row now holds. */
        <div className="mt-9 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6" aria-hidden="true">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="h-[340px] rounded-tnr-lg border border-gray-100 bg-white/60 animate-pulse" />
          ))}
        </div>
      ) : (
        /* No RevealGroup/RevealItem: the card animates itself now — a
           motion.article with its own whileInView and a stagger from its
           index — so a second reveal around it put two animations on one
           element's opacity. That also retires the `key={executive.length}`
           remount this grid needed, because RevealGroup fired once and cards
           arriving after the observer had run stayed invisible. */
        <div className="mt-9 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
          {executive.map((m, i) => <ExecutiveCard key={m.slug} member={m} index={i} />)}
        </div>
      )}
    </section>
  );
}
