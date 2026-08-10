import 'server-only';
import { supabaseAdmin } from './supabaseServer';
import { PUBLIC_SLIDE_COLUMNS } from './heroSlides';

/* Hero slides, read directly on the server.
 *
 * Deliberately separate from lib/heroSlides.js. That file holds the shared
 * shape and clamps and is imported by the admin form in the browser; this one
 * touches the service-role Supabase client and must never reach a bundle. The
 * `server-only` import turns an accidental client import into a build error
 * rather than a leaked key.
 *
 * The API route at /api/public/hero still exists and is unchanged — the admin
 * preview and any client-side refresh use it. This is the same query, read at
 * render time so the first slide's <img> ships inside the HTML.
 */
export async function getHeroSlides() {
  try {
    const { data, error } = await supabaseAdmin().from('hero_slides')
      .select(PUBLIC_SLIDE_COLUMNS)
      .eq('active', true)
      .order('sort_order').order('created_at');

    // An empty list is a valid answer: the carousel falls back to the built-in
    // hero. A missing table — the migration not yet run — must not take the
    // front page down with it, and this now runs during the build, where an
    // unreachable database would otherwise fail the deploy outright.
    if (error) return [];

    // A slide with neither words nor a picture renders as a blank panel.
    return (data || []).filter(s => s.title || s.subtitle || s.image_url);
  } catch {
    return [];
  }
}
