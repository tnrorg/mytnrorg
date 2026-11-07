import { supabaseAdmin } from '@/lib/supabaseServer';
import { ok } from '@/lib/api';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

// Public, read-only. Returns active profiles only, split by body.
// If the table is missing or empty the site falls back to its built-in list,
// so the homepage never renders an empty leadership section.

/* The shape of a failure, written once.
 *
 * Both failure branches used to spell out the same four keys. Adding a roster
 * meant remembering to add it in three places, and the one that gets forgotten
 * is a catch block — where the client then reads `undefined.length` on a day
 * the database is already having trouble. */
const EMPTY = { advisory: [], executive: [], ambassadors: [], countryAmbassadors: [] };
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin().from('leadership_profiles')
      .select('body, slug, name, designation, qualification, field, affiliation, summary, expertise, duties, photo_url, sort_order')
      .eq('active', true).order('sort_order').order('created_at');

    // `failed` is the point of this branch. Previously a database error and a
    // genuinely empty table both returned empty arrays, so the client could not
    // tell "nobody is configured" from "the query broke" — it fell back to the
    // built-in placeholder roster either way, and real office bearers appeared
    // as "To Be Announced" at random. The flag lets the client retry a failure
    // and accept an empty result.
    if (error) return ok({ ...EMPTY, failed: true });

    const rows = data || [];
    return ok({
      advisory:  rows.filter(r => r.body === 'advisory'),
      executive: rows.filter(r => r.body === 'executive'),
      /* Each ambassador roster is its own array rather than one mixed list.
       *
       * The home page gives them separate headings — Country, then University
       * — so folding them together would only have to be undone. And a body
       * that arrives merged into another can never be split out later without
       * breaking whatever started relying on the merged list.
       *
       * `ambassadors` is the University roster and keeps its original name:
       * it is already being read by the live site, and the body key behind it
       * is still 'ambassador' for the reason set out in
       * supabase/migration_country_ambassadors.sql. */
      ambassadors: rows.filter(r => r.body === 'ambassador'),
      countryAmbassadors: rows.filter(r => r.body === 'country_ambassador'),
      failed: false,
    });
  } catch {
    return ok({ ...EMPTY, failed: true });
  }
}
