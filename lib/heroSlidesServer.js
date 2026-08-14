import 'server-only';
import { supabaseAdmin } from './supabaseServer';
import { PUBLIC_SLIDE_COLUMNS, PUBLIC_SLIDE_COLUMNS_BASE } from './heroSlides';

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
  const read = (cols) => supabaseAdmin().from('hero_slides')
    .select(cols)
    .eq('active', true)
    .order('sort_order').order('created_at');

  try {
    let { data, error } = await read(PUBLIC_SLIDE_COLUMNS);

    /* Retry without the optional columns.
     *
     * Postgres rejects the entire query if it names a column that does not
     * exist, and the caller reads an error as "no slides" — so a deployment
     * that runs ahead of its migration silently replaced the whole
     * admin-managed carousel with the built-in fallback hero. One missing
     * label should cost a label, not the hero.
     */
    if (error) {
      console.warn('[hero] full select failed, retrying without optional columns:', error.message);
      ({ data, error } = await read(PUBLIC_SLIDE_COLUMNS_BASE));
    }

    // Still failing means something more fundamental — a missing table, or the
    // migration never run at all. The built-in hero covers it so the front
    // page is never blank, and this also runs during the build, where an
    // unreachable database would otherwise fail the deploy outright.
    if (error) {
      console.error('[hero] slides unavailable:', error.message);
      return [];
    }

    // A slide with neither words nor a picture renders as a blank panel.
    return (data || []).filter(s => s.title || s.subtitle || s.image_url);
  } catch (e) {
    console.error('[hero] slides threw:', e.message);
    return [];
  }
}
