import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAdmin } from '@/lib/guard';
import { uploadDataUrl } from '@/lib/storage';
import { logAudit, clientIp } from '@/lib/audit';
import { ok, fail, readJson } from '@/lib/api';
export const dynamic = 'force-dynamic';

export async function PATCH(req, props) {
  const params = await props.params;
  const { admin, res } = await requireAdmin(req);if (res) return res;
  const sb = supabaseAdmin();
  const b = await readJson(req);
  const patch = {};
  for (const f of ['full_name', 'role', 'phone', 'email', 'bio', 'active']) if (f in b) patch[f] = b[f];
  if ('sort_order' in b) patch.sort_order = Number(b.sort_order) || 0;
  if (b.photo_data) { try { patch.photo_url = await uploadDataUrl(b.photo_data, 'committee'); } catch (e) { console.error('committee photo upload failed:', e.message); } }
  else if ('photo_url' in b) patch.photo_url = b.photo_url;
  const { data, error } = await sb.from('committee_members').update(patch).eq('id', params.id).select().maybeSingle();
  if (error) return fail('UPDATE_FAILED', 500, { message: error.message });
  await logAudit({ action: 'COMMITTEE_MEMBER_UPDATED', actor: admin.username, details: data?.full_name || params.id, ip: clientIp(req) });
  return ok({ member: data });
}

export async function DELETE(req, props) {
  const params = await props.params;
  const { admin, res } = await requireAdmin(req);if (res) return res;
  const { error } = await supabaseAdmin().from('committee_members').delete().eq('id', params.id);
  if (error) return fail('DELETE_FAILED', 500, { message: error.message });
  await logAudit({ action: 'COMMITTEE_MEMBER_DELETED', actor: admin.username, details: params.id, ip: clientIp(req) });
  return ok({});
}
