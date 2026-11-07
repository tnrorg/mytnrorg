'use client';
import ExecutiveCard from '@/components/site/ExecutiveCard';
import { Reveal } from '@/components/ui';

const C = { deep: '#063D2B', gold: '#D4A72C' };
const mont = { fontFamily: 'var(--font-mulish), Mulish, system-ui, sans-serif' };

/* An ambassador roster on the home page.
 *
 * ONE COMPONENT, TWO BODIES. Country Ambassadors and University Ambassadors
 * differ only in their heading, their wording and which array they read — the
 * card, the grid, the reveal behaviour and the empty-state rule are identical.
 * Copying the file to add the second roster would have meant that a fix to the
 * grid, or to the `key` trick below, landed in one of them and not the other;
 * that is exactly how the meetings invite picker came to be missing a body
 * that the server had known about for weeks.
 *
 * IT RENDERS NOTHING WHEN THE ROSTER IS EMPTY.
 *
 * Not an empty grid, not a heading with white space under it, not a row of
 * "To Be Announced" cards — `return null`. The Advisory Council and the CEC
 * have fixed establishments, so a placeholder there is accurate between terms.
 * Ambassadors are appointed per campus and per country with no fixed number,
 * so an empty section would be advertising a body that does not yet exist.
 * The section appears the moment the first one is added in admin.
 *
 * It also stays silent while the roster is loading. The CEC section above it
 * already shows skeleton panels and carries the page's loading state; a second
 * set of pulsing boxes under it would read as the page breaking, and this
 * section may legitimately have nothing to show once loaded.
 */
export default function AmbassadorSection({ title, intro, members, loading }) {
  if (loading || !members?.length) return null;

  return (
    <section className="max-w-[1400px] mx-auto px-4 py-14 w-full">
      <Reveal className="flex items-center justify-center gap-3">
        <span className="h-px w-10 sm:w-20" style={{ background: `${C.gold}66` }} />
        <h2 style={{ ...mont, color: C.deep }}
          className="text-lg sm:text-xl font-black uppercase tracking-wide text-center">
          {title}
        </h2>
        <span className="h-px w-10 sm:w-20" style={{ background: `${C.gold}66` }} />
      </Reveal>

      <Reveal delay={0.06}>
        <p className="mt-3 text-center text-sm text-gray-600 max-w-3xl mx-auto leading-relaxed">
          {intro}
        </p>
      </Reveal>

      {/* The same card and the same grid as the Central Executive Committee
          above, deliberately. Ambassadors are a different body, not a
          different kind of person, and inventing a second card style here
          would make the page look assembled from two products.

          NO RevealGroup/RevealItem AROUND THESE. The card animates itself —
          it is a motion.article with its own whileInView and a stagger taken
          from its index — so wrapping it in a second reveal put two
          animations on one element's opacity. That also retires the
          `key={members.length}` remount this grid used to need: RevealGroup
          fired once, so cards arriving after the observer had already run
          stayed at opacity 0 and the whole section rendered as blank space.
          A per-card observer has no such window. */}
      {/* 2 / 3 / 4 across, the same as the CEC grid. */}
      <div className="mt-9 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
        {members.map((m, i) => <ExecutiveCard key={m.slug} member={m} index={i} />)}
      </div>
    </section>
  );
}
