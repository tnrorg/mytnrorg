import { supabaseAdmin } from '@/lib/supabaseServer';
import { ok } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

/**
 * Live announcement lines for the home-page ticker.
 *
 * Scheduling is applied here rather than in the component so an expired notice
 * is never sent to the browser at all. Returns an empty list on any failure —
 * the ticker then renders nothing, which is correct for a decorative strip.
 */
export async function GET() {
  try {
    const now = new Date().toISOString();
    const { data, error } = await supabaseAdmin()
      .from('announcements')
      .select('id, text, href, starts_at, ends_at')
      .eq('active', true)
      .order('sort_order')
      .order('created_at');

    if (error) return ok({ items: [] });

    const items = (data || [])
      .filter(a => (!a.starts_at || a.starts_at <= now) && (!a.ends_at || a.ends_at >= now))
      .map(({ id, text, href }) => ({ id, text, href: href || null }));

    return ok({ items });
  } catch {
    return ok({ items: [] });
  }
}
