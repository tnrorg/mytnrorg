import { supabaseAdmin } from '@/lib/supabaseServer';
import { ok } from '@/lib/api';
import { PUBLIC_INSTITUTION_COLUMNS, summarise } from '@/lib/institutions';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

/* Public, read-only: published schools, colleges and training centres.
 *
 * The column list omits `contact` on purpose — publishing a head teacher's
 * phone number is not something they consented to.
 *
 * An empty list is a valid answer; a missing table behaves the same way rather
 * than erroring, so the page keeps working before the migration is run.
 */
export async function GET() {
  const empty = { institutions: [], stats: summarise([]) };
  try {
    const { data, error } = await supabaseAdmin().from('tnr_institutions')
      .select(PUBLIC_INSTITUTION_COLUMNS)
      .eq('published', true)
      .order('sort_order').order('name');
    if (error) return ok(empty);

    const institutions = data || [];
    return ok({ institutions, stats: summarise(institutions) });
  } catch {
    return ok(empty);
  }
}
