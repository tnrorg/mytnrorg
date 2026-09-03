import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAdmin } from '@/lib/guard';
import { logAudit, clientIp } from '@/lib/audit';
import { ok, fail, readJson } from '@/lib/api';
export const dynamic = 'force-dynamic';

export async function PATCH(req, props) {
  const params = await props.params;
  const { admin, res } = requireAdmin(req);if (res) return res;
  const sb = supabaseAdmin();
  const b = await readJson(req);
  const patch = {};
  if ('title' in b) patch.title = b.title;
  if ('sort_order' in b) patch.sort_order = b.sort_order;
  const { data, error } = await sb.from('positions').update(patch).eq('id', params.id).select().maybeSingle();
  if (error) return fail('UPDATE_FAILED', 500, { message: error.message });
  await logAudit({ action: 'POSITION_UPDATED', actor: admin.username, details: data?.title || params.id, ip: clientIp(req) });
  return ok({ position: data });
}
export async function DELETE(req, props) {
  const params = await props.params;
  const { admin, res } = requireAdmin(req);if (res) return res;
  const sb = supabaseAdmin();
  // Candidates keep existing (their position_id is set null by FK). Block if the election has votes for this position.
  const { count } = await sb.from('votes').select('*', { count: 'exact', head: true }).eq('position_id', params.id);
  if (count) return fail('HAS_VOTES', 409, { message: 'Cannot delete: votes already exist for this position.' });
  const { error } = await sb.from('positions').delete().eq('id', params.id);
  if (error) return fail('DELETE_FAILED', 500, { message: error.message });
  await logAudit({ action: 'POSITION_DELETED', actor: admin.username, details: params.id, ip: clientIp(req) });
  return ok({});
}
