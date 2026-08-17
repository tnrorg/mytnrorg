import { supabaseAdmin } from '@/lib/supabaseServer';
import { ok, readJson } from '@/lib/api';

export const dynamic = 'force-dynamic';

/* Records one read of a news post. Mirrors the Opinions counter exactly.
 *
 * Always answers ok: a counter is a nice-to-have, and an error here must never
 * interrupt someone reading. The worst acceptable outcome is a number that is
 * slightly low.
 *
 * The increment happens inside Postgres (bump_news_views), so two readers
 * arriving in the same moment cannot overwrite each other's count.
 */
export async function POST(req) {
  try {
    const { slug } = await readJson(req);
    if (!slug || typeof slug !== 'string') return ok({ counted: false });

    const { data, error } = await supabaseAdmin()
      .rpc('bump_news_views', { p_slug: slug.slice(0, 200) });

    if (error) {
      console.warn('[news view] not counted:', error.message);
      return ok({ counted: false });
    }
    return ok({ counted: true, views: data ?? 0 });
  } catch {
    return ok({ counted: false });
  }
}
