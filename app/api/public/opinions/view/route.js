import { supabaseAdmin } from '@/lib/supabaseServer';
import { ok, readJson } from '@/lib/api';

export const dynamic = 'force-dynamic';

/* Records one read of an Opinion.
 *
 * Deliberately forgiving: it always answers ok. A counter is a nice-to-have,
 * and an error here must never interrupt someone reading an article — the
 * worst acceptable outcome is a number that is slightly low.
 *
 * The increment happens inside Postgres (bump_opinion_views) rather than as
 * read-then-write in this handler, so two readers arriving together cannot
 * overwrite each other's count.
 *
 * Deduplication is per browser session, done on the client. That is a soft
 * limit — anyone determined can clear their session and count again — and
 * that is the right trade for a public read counter. Tying it to an identity
 * would mean tracking readers, which is a far worse thing to build than a
 * slightly inflated number.
 */
export async function POST(req) {
  try {
    const { slug } = await readJson(req);
    if (!slug || typeof slug !== 'string') return ok({ counted: false });

    const { data, error } = await supabaseAdmin()
      .rpc('bump_opinion_views', { p_slug: slug.slice(0, 200) });

    if (error) {
      // Most likely the migration has not been run. Logged, not surfaced.
      console.warn('[opinion view] not counted:', error.message);
      return ok({ counted: false });
    }
    return ok({ counted: true, views: data ?? 0 });
  } catch {
    return ok({ counted: false });
  }
}
