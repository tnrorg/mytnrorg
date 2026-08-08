import { supabaseAdmin } from '@/lib/supabaseServer';
import { ok } from '@/lib/api';
import { HEADER_DEFAULTS } from '@/lib/siteHeader';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

/**
 * Public: tagline and social links for the utility bar.
 * Never fails — a missing table returns the defaults, because the header
 * renders on every page of the site.
 */
export async function GET() {
  const header = { ...HEADER_DEFAULTS };
  try {
    const { data, error } = await supabaseAdmin()
      .from('membership_settings')
      .select('key, value')
      .in('key', Object.keys(HEADER_DEFAULTS));
    if (!error) {
      for (const r of data || []) {
        if (r.value != null) header[r.key] = String(r.value);
      }
    }
  } catch { /* defaults already in place */ }
  return ok({ header });
}
