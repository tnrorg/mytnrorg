'use client';
import ExecutiveCard from '@/components/site/ExecutiveCard';
import { useLeadership } from '@/components/site/useLeadership';
import { Reveal, RevealGroup, RevealItem } from '@/components/ui';

const C = { deep: '#063D2B', gold: '#D4A72C' };
const mont = { fontFamily: 'var(--font-mulish), Mulish, system-ui, sans-serif' };

/* The wording under the heading. Kept here as a named constant, beside the one
 * section that uses it, so changing the copy is one obvious edit. */
export const AMBASSADORS_INTRO =
  'University Ambassadors represent TNR on their campuses — connecting Roundu '
  + 'students studying away from home to the organisation, sharing opportunities, '
  + 'and supporting TNR programmes within their universities and colleges.';

/* University Ambassadors — the roster directly below the Central Executive
 * Committee on the home page.
 *
 * IT RENDERS NOTHING WHEN THERE ARE NO AMBASSADORS.
 *
 * Not an empty grid, not a heading with white space under it, not a row of
 * "To Be Announced" cards — `return null`. The Advisory Council and the CEC
 * have fixed establishments, so a placeholder there is accurate between
 * terms. Ambassadors are appointed per campus with no fixed number, so an
 * empty section would be advertising a body that does not yet exist. The
 * section appears the moment the first one is added in admin.
 *
 * It also stays silent while the roster is loading. The CEC section above it
 * already shows skeleton panels and carries the page's loading state; a second
 * set of pulsing boxes under it would read as the page breaking, and this
 * section may legitimately have nothing to show once loaded.
 */
export default function UniversityAmbassadors() {
  const { ambassadors, loading } = useLeadership();

  if (loading || !ambassadors?.length) return null;

  return (
    <section className="max-w-[1400px] mx-auto px-4 py-14 w-full">
      <Reveal className="flex items-center justify-center gap-3">
        <span className="h-px w-10 sm:w-20" style={{ background: `${C.gold}66` }} />
        <h2 style={{ ...mont, color: C.deep }}
          className="text-lg sm:text-xl font-black uppercase tracking-wide text-center">
          University Ambassadors
        </h2>
        <span className="h-px w-10 sm:w-20" style={{ background: `${C.gold}66` }} />
      </Reveal>

      <Reveal delay={0.06}>
        <p className="mt-3 text-center text-sm text-gray-600 max-w-3xl mx-auto leading-relaxed">
          {AMBASSADORS_INTRO}
        </p>
      </Reveal>

      {/* The same card and the same grid as the Central Executive Committee
          above, deliberately. Ambassadors are a different body, not a different
          kind of person, and inventing a second card style here would make the
          page look assembled from two products.

          `key` on the count is load-bearing, exactly as it is in the CEC
          section: RevealGroup animates once, and the roster arrives
          asynchronously, so cards mounting after the observer has fired would
          stay at opacity 0 and the section would render as blank space. */}
      <RevealGroup key={ambassadors.length}
        className="mt-9 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {ambassadors.map(m => (
          <RevealItem key={m.slug} className="h-full">
            <ExecutiveCard member={m} />
          </RevealItem>
        ))}
      </RevealGroup>
    </section>
  );
}
