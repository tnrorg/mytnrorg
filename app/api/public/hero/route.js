import { supabaseAdmin } from '@/lib/supabaseServer';
import { ok } from '@/lib/api';
import { PUBLIC_SLIDE_COLUMNS } from '@/lib/heroSlides';
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
  try {
    const { data, error } = await supabaseAdmin().from('hero_slides')
      .select(PUBLIC_SLIDE_COLUMNS)
      .eq('active', true)
      .order('sort_order').order('created_at');
    if (error) return ok({ slides: [] });

    // A slide with neither words nor a picture would render as a blank panel.
    const slides = (data || []).filter(s => s.title || s.subtitle || s.image_url);
    return ok({ slides });
  } catch {
    return ok({ slides: [] });
  }
}
