import { supabaseAdmin } from '@/lib/supabaseServer';
import { ok } from '@/lib/api';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export async function GET() {
  const { data } = await supabaseAdmin()
    .from('committee_members')
    .select('id, full_name, role, photo_url, bio, sort_order')
    .eq('active', true).order('sort_order').order('created_at');
  return ok({ members: data || [] });
}
