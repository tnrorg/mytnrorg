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
    if (error) return ok({ advisory: [], executive: [] });
    const rows = data || [];
    return ok({
      advisory:  rows.filter(r => r.body === 'advisory'),
      executive: rows.filter(r => r.body === 'executive'),
    });
  } catch {
    return ok({ advisory: [], executive: [] });
  }
}
