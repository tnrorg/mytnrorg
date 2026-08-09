import { supabaseAdmin } from '@/lib/supabaseServer';
import { ok } from '@/lib/api';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

// Public, read-only. Returns active profiles only, split by body.
// If the table is missing or empty the site falls back to its built-in list,
// so the homepage never renders an empty leadership section.
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
    if (error) return ok({ advisory: [], executive: [], failed: true });

    const rows = data || [];
    return ok({
      advisory:  rows.filter(r => r.body === 'advisory'),
      executive: rows.filter(r => r.body === 'executive'),
      failed: false,
    });
  } catch {
    return ok({ advisory: [], executive: [], failed: true });
  }
}
