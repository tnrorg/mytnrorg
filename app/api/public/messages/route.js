import { supabaseAdmin } from '@/lib/supabaseServer';
import { ok } from '@/lib/api';
import { MESSAGE_KEYS, isPublishable } from '@/lib/leadershipMessages';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

/* Public, read-only: the Founder's and President's messages for the home page.
 *
 * Returns only rows an admin has published AND written. An unpublished or
 * empty row is simply absent, and the home page renders nothing for it —
 * better than a card with a placeholder name on the front of the site.
 *
 * A missing table (migration not yet run) returns an empty list, not an error,
 * so the home page keeps working.
 */
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin().from('leadership_messages')
      .select('key, heading, name, designation, photo_url, signature_url, message, sort_order, published')
      .order('sort_order');
    if (error) return ok({ messages: [] });

    const messages = (data || [])
      .filter(isPublishable)
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) ||
        MESSAGE_KEYS.indexOf(a.key) - MESSAGE_KEYS.indexOf(b.key))
      .map(({ published, ...m }) => m);   // `published` is internal state

    return ok({ messages });
  } catch {
    return ok({ messages: [] });
  }
}
