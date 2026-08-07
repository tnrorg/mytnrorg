import { ok, fail } from '@/lib/api';
import { getMembershipGeography } from '@/lib/membershipGeography';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

/* Public, read-only: aggregated member counts by location.
 *
 * Returns counts and place names only — the query behind it never reads a
 * name, email, phone number or date of birth, so there is nothing here to
 * filter out.
 *
 * Uncached on purpose. The figures have to move the moment an application is
 * approved, a member updates their address, or a membership is suspended or
 * deleted; a cache would leave the public page quietly wrong for its duration.
 * The cost is one indexed query over six columns, which stays cheap well
 * beyond the scale TNR is at.
 */
export async function GET() {
  try {
    return ok(await getMembershipGeography());
  } catch (e) {
    // A missing column means migration_address_organization.sql has not been
    // run. Say so, rather than returning zeros that look like real figures.
    const missing = /column .* does not exist|schema cache/i.test(e.message || '');
    return fail(missing ? 'SCHEMA_OUT_OF_DATE' : 'STATS_FAILED', 500, {
      message: 'Membership figures are unavailable right now.',
      detail: e.message,
      hint: missing ? 'Run supabase/migration_address_organization.sql in the Supabase SQL Editor.' : undefined,
    });
  }
}
