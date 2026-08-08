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
    const community = { ...s.community, visits: await visitCount() };
    return ok({ community, top5: s.top5, segments: s.segments, balanced: s.balanced });
  } catch (e) {
    return fail('STATS_FAILED', 500, { message: e.message });
  }
}

/**
 * Total website visits. Returns null rather than 0 when the counter is
 * unavailable — the stats bar hides the tile on null, whereas a 0 would
 * publish "0 visitors" on a site that plainly has some.
 */
async function visitCount() {
  try {
    const { supabaseAdmin } = await import('@/lib/supabaseServer');
    const { data, error } = await supabaseAdmin()
      .from('site_counters').select('value').eq('key', 'visits').maybeSingle();
    if (error || !data) return null;
    return Number(data.value) || 0;
  } catch {
    return null;
  }
}
