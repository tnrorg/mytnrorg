import { supabaseAdmin } from '@/lib/supabaseServer';
import { ok } from '@/lib/api';
import { PUBLIC_SLIDE_COLUMNS, PUBLIC_SLIDE_COLUMNS_BASE } from '@/lib/heroSlides';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

/* Public, read-only: the hero carousel slides.
 *
 * An empty list is a valid answer — the home page then falls back to its
 * built-in hero, so a missing table (migration not yet run) or an admin who
 * has deactivated every slide never leaves the front page blank.
 */
export async function GET() {
  const read = (cols) => supabaseAdmin().from('hero_slides')
    .select(cols)
    .eq('active', true)
    .order('sort_order').order('created_at');

  try {
    let { data, error } = await read(PUBLIC_SLIDE_COLUMNS);
    // Optional columns may not exist yet on a database behind the deployment.
    // Losing a label is acceptable; losing every slide is not — see
    // lib/heroSlides.js for the full account.
    if (error) ({ data, error } = await read(PUBLIC_SLIDE_COLUMNS_BASE));
    if (error) {
      console.error('[hero api] slides unavailable:', error.message);
      return ok({ slides: [] });
    }

    // A slide with neither words nor a picture would render as a blank panel.
    const slides = (data || []).filter(s => s.title || s.subtitle || s.image_url);
    return ok({ slides });
  } catch {
    return ok({ slides: [] });
  }
}
