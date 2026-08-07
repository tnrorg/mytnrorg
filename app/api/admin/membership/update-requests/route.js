import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAdmin } from '@/lib/guard';
import { ok } from '@/lib/api';
export const dynamic = 'force-dynamic';

export async function GET(req) {
  const { res } = requireAdmin(req); if (res) return res;
  const status = new URL(req.url).searchParams.get('status') || 'pending';
  const sb = supabaseAdmin();
  const { data: reqs } = await sb.from('profile_update_requests').select('*')
    .eq('status', status).order('created_at', { ascending: false }).limit(300);

  const ids = [...new Set((reqs || []).map(r => r.member_id))];
  const { data: members } = ids.length
    ? await sb.from('membership_members').select('id, membership_id, full_name, email').in('id', ids)
    : { data: [] };
  const map = Object.fromEntries((members || []).map(m => [m.id, m]));

  return ok({ requests: (reqs || []).map(r => ({ ...r, member: map[r.member_id] || null })) });
}
