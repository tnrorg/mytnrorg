import { getMembershipStats } from '@/lib/membershipStats';
import { ok, fail } from '@/lib/api';

// Aggregate community counts for the homepage. No personal data, and every
// figure is derived from the same de-duplicated active-member set the members
// page uses, so the two can never show different totals.
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export async function GET() {
  try {
    const s = await getMembershipStats();
    return ok({ community: s.community, top5: s.top5, segments: s.segments, balanced: s.balanced });
  } catch (e) {
    return fail('STATS_FAILED', 500, { message: e.message });
  }
}
