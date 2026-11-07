'use client';
import AmbassadorSection from './AmbassadorSection';
import { useLeadership } from '@/components/site/useLeadership';

/* The wording under each heading. Kept here as named constants, beside the
 * sections that use them, so changing the copy is one obvious edit. */
export const AMBASSADORS_INTRO =
  'University Ambassadors represent TNR on their campuses — connecting Roundu '
  + 'students studying away from home to the organisation, sharing opportunities, '
  + 'and supporting TNR programmes within their universities and colleges.';

export const COUNTRY_AMBASSADORS_INTRO =
  'Country Ambassadors represent TNR in the countries where they live and work — '
  + 'supporting the Roundu community abroad, building links with institutions and '
  + 'organisations there, and carrying TNR’s work beyond Pakistan.';

/* Both rosters read from one `useLeadership()` call each. That is deliberate:
 * the hook holds its own state per component, but the underlying request is a
 * plain fetch of the same endpoint, and React dedupes neither — so each
 * section makes one request. Two small requests is the accepted cost of
 * keeping each section independent and individually removable; if that ever
 * matters, lift the hook into app/page.js and pass the arrays down. */

/** Country Ambassadors — directly after the Central Executive Committee. */
export function CountryAmbassadors() {
  const { countryAmbassadors, loading } = useLeadership();
  return (
    <AmbassadorSection title="Country Ambassadors" intro={COUNTRY_AMBASSADORS_INTRO}
      members={countryAmbassadors} loading={loading} />
  );
}

/** University Ambassadors — after the Country Ambassadors. */
export default function UniversityAmbassadors() {
  const { ambassadors, loading } = useLeadership();
  return (
    <AmbassadorSection title="University Ambassadors" intro={AMBASSADORS_INTRO}
      members={ambassadors} loading={loading} />
  );
}
