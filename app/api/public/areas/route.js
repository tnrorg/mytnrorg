import { supabaseAdmin } from '@/lib/supabaseServer';
import { ok } from '@/lib/api';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

// Read-only list for the application form's dependent dropdowns.
// Returns [] rather than an error if the migration has not been run, so the
// form can fall back to free-text entry instead of blocking applicants.
export async function GET() {
  try {
    const sb = supabaseAdmin();
    const [{ data: ucs }, { data: villages }] = await Promise.all([
      sb.from('membership_union_councils').select('id, name')
        .eq('active', true).order('sort_order').order('name'),
      sb.from('membership_villages').select('union_council_id, name')
        .eq('active', true).order('sort_order').order('name'),
    ]);
    if (!ucs) return ok({ councils: [] });
    return ok({
      councils: ucs.map(u => ({
        name: u.name,
        villages: (villages || []).filter(v => v.union_council_id === u.id).map(v => v.name),
      })),
    });
  } catch {
    return ok({ councils: [] });
  }
}
