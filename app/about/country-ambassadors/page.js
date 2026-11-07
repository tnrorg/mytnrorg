'use client';
import DocPage, { Section, P } from '@/components/site/DocPage';
import Breakout from '@/components/site/Breakout';
import { AmbassadorGrid } from '@/components/home/AmbassadorSection';
import { COUNTRY_AMBASSADORS_INTRO } from '@/components/home/UniversityAmbassadors';
import { useLeadership } from '@/components/site/useLeadership';

/* The whole country roster.
 *
 * It fits on the home page today — seven people, under the eight-card preview
 * limit, so no "View all" button appears there yet. The page exists anyway:
 * the roster will outgrow the limit, the assistant's leadership lookup needs
 * somewhere real to link to instead of the home page, and a body with its own
 * section but no page of its own is the odd one out under About TNR. */
export default function CountryAmbassadorsPage() {
  const { countryAmbassadors, loading } = useLeadership();

  return (
    <DocPage eyebrow="Leadership" title="Country Ambassadors"
      lead="TNR's representatives in the countries where our members live and work."
      source="TNR leadership records — maintained by the Central Executive Committee.">

      <Section title="Role"><P>{COUNTRY_AMBASSADORS_INTRO}</P></Section>

      <Section title={loading ? 'Ambassadors' : `Ambassadors (${countryAmbassadors.length})`}>
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
          ) : countryAmbassadors.length ? (
            <AmbassadorGrid members={countryAmbassadors} />
          ) : (
            <p className="text-sm text-gray-500">
              Country Ambassadors will appear here once they are appointed.
            </p>
          )}
        </Breakout>
      </Section>
    </DocPage>
  );
}
