import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAdmin } from '@/lib/guard';
import { logAudit, clientIp } from '@/lib/audit';
import { ok } from '@/lib/api';
export const dynamic = 'force-dynamic';

// Approve every Pending member in one click.
export async function POST(req) {
  const { admin, res } = await requireAdmin(req); if (res) return res;
  const sb = supabaseAdmin();
  const { data, error } = await sb.from('members')
    .update({ status: 'Approved', updated_at: new Date().toISOString() })
    .eq('status', 'Pending').select('id');
  if (error) return ok({ approved: 0, error: error.message });
  await logAudit({ action: 'MEMBERS_BULK_APPROVED', actor: admin.username, details: `${data?.length || 0} approved`, ip: clientIp(req) });
  return ok({ approved: data?.length || 0 });
}
