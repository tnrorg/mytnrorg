import { supabaseAdmin } from '@/lib/supabaseServer';
import { ok } from '@/lib/api';
import { CARD_DEFAULTS } from '@/lib/cardDefaults';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

// Read-only. Falls back to the built-in defaults so a member's card always
// renders, even before the migration has been run.
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin().from('card_settings').select('*').eq('id', 1).maybeSingle();
    if (error || !data) return ok({ settings: CARD_DEFAULTS });
    return ok({ settings: { ...CARD_DEFAULTS, ...Object.fromEntries(Object.entries(data).filter(([, v]) => v != null && v !== '')) } });
  } catch {
    return ok({ settings: CARD_DEFAULTS });
  }
}
