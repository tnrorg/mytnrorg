import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireMember } from '@/lib/membership/auth';
import { ok, readJson } from '@/lib/api';
export const dynamic = 'force-dynamic';

export async function GET(req) {
  const { member, res } = await requireMember(req); if (res) return res;
  const { data } = await supabaseAdmin().from('membership_notifications')
    .select('*').eq('member_id', member.id).order('created_at', { ascending: false }).limit(100);
  const rows = data || [];
  return ok({ notifications: rows, unread: rows.filter(n => !n.read_at).length });
}

// Mark one, or all, as read.
export async function PATCH(req) {
  const { member, res } = await requireMember(req); if (res) return res;
  const b = await readJson(req);
  const sb = supabaseAdmin();
  const now = new Date().toISOString();
  let q = sb.from('membership_notifications').update({ read_at: now }).eq('member_id', member.id).is('read_at', null);
  if (b.id) q = q.eq('id', b.id);
  await q;
  return ok({ marked: true });
}
