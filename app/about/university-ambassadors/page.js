'use client';
import DocPage, { Section, P } from '@/components/site/DocPage';
import Breakout from '@/components/site/Breakout';
import { AmbassadorGrid } from '@/components/home/AmbassadorSection';
import { AMBASSADORS_INTRO } from '@/components/home/UniversityAmbassadors';
import { useLeadership } from '@/components/site/useLeadership';

/* The whole campus roster.
 *
 * The home page shows the first eight and links here, because 27 cards made
 * that section nearly three times taller than any other on the page. This is
 * where the rest live. */
export default function UniversityAmbassadorsPage() {
  const { ambassadors, loading } = useLeadership();

  return (
    <DocPage eyebrow="Leadership" title="University Ambassadors"
      lead="TNR's representatives on campuses at home and abroad."
      source="TNR leadership records — maintained by the Central Executive Committee.">

      <Section title="Role"><P>{AMBASSADORS_INTRO}</P></Section>

      <Section title={loading ? 'Ambassadors' : `Ambassadors (${ambassadors.length})`}>
        {/* Out of the reading column — see components/site/Breakout.js. */}
        <Breakout>
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6"
              aria-hidden="true">
              {[0, 1, 2, 3].map(i => (
                <div key={i}
                  className="h-[16rem] sm:h-[25rem] rounded-tnr-lg border border-gray-100
                    bg-white/60 animate-pulse" />
              ))}
            </div>
          ) : ambassadors.length ? (
            <AmbassadorGrid members={ambassadors} />
          ) : (
            <p className="text-sm text-gray-500">
              University Ambassadors will appear here once they are appointed.
            </p>
          )}
        </Breakout>
      </Section>
    </DocPage>
  );
}
