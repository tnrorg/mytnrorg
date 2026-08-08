import { supabaseAdmin } from '@/lib/supabaseServer';
import { ok } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

/**
 * Records one website visit.
 *
 * Called once per browser session by <VisitTracker/>, not on every page view —
 * a member clicking through six pages is one visitor, and counting navigations
 * would inflate the figure the home page publishes.
 *
 * Deliberately silent on failure: a counter is not worth surfacing an error to
 * a visitor over, and the stats bar simply omits the figure if it is missing.
 */
export async function POST() {
  try {
    const { data, error } = await supabaseAdmin().rpc('increment_site_visits', { amount: 1 });
    if (error) return ok({ counted: false });
    return ok({ counted: true, visits: data });
  } catch {
    return ok({ counted: false });
  }
}
