import { getMembershipStats } from '@/lib/membershipStats';
import { ok, fail } from '@/lib/api';

// Aggregate counts only — no personal data of any kind is returned here, so
// private members contribute to the totals without being individually exposed.
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export async function GET() {
  try {
    return ok({ stats: await getMembershipStats() });
  } catch (e) {
    return fail('STATS_FAILED', 500, { message: e.message });
  }
}
