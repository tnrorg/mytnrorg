import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAdmin } from '@/lib/guard';
import { normalizePhone } from '@/lib/phone';
import { getActiveElection } from '@/lib/election';
import { logAudit, clientIp } from '@/lib/audit';
import { ok, fail, readJson } from '@/lib/api';
export const dynamic = 'force-dynamic';

export async function PATCH(req, props) {
  const params = await props.params;
  const { admin, res } = await requireAdmin(req);if (res) return res;
  const sb = supabaseAdmin();
  const id = params.id;
  const b = await readJson(req);
  const patch = { updated_at: new Date().toISOString() };
  for (const f of ['full_name','member_code','father_name','cnic','email','village','gender','status']) if (f in b) patch[f] = b[f];
  if ('mobile' in b)   patch.mobile = normalizePhone(b.mobile);
  if ('whatsapp' in b) patch.whatsapp = b.whatsapp ? normalizePhone(b.whatsapp) : null;
  if ('union_id' in b) patch.union_id = b.union_id || null;

  const { data, error } = await sb.from('members').update(patch).eq('id', id).select().maybeSingle();
  if (error) return fail('UPDATE_FAILED', 500, { message: error.message });
  const action = b.status === 'Approved' ? 'MEMBER_APPROVED' : b.status === 'Blocked' ? 'MEMBER_BLOCKED' : 'MEMBER_UPDATED';
  await logAudit({ action, actor: admin.username, details: `${data?.full_name || id}`, ip: clientIp(req) });
  return ok({ member: data });
}

export async function DELETE(req, props) {
  const params = await props.params;
  const { admin, res } = await requireAdmin(req);if (res) return res;
  const sb = supabaseAdmin();
  const { error } = await sb.from('members').delete().eq('id', params.id);
  if (error) return fail('DELETE_FAILED', 500, { message: error.message });
  await logAudit({ action: 'MEMBER_DELETED', actor: admin.username, details: params.id, ip: clientIp(req) });
  return ok({});
}
