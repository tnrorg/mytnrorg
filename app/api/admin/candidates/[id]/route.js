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
  for (const f of ['name','symbol','manifesto','education','status','sort_order','position_id','union_id']) if (f in b) patch[f] = b[f];
  if (b.photo_data) { try { patch.photo_url = await uploadDataUrl(b.photo_data, 'candidates'); } catch (e) { console.error('photo upload failed:', e.message); } }
  else if ('photo_url' in b) patch.photo_url = b.photo_url;
  if (b.symbol_data) { try { patch.symbol_url = await uploadDataUrl(b.symbol_data, 'symbols'); } catch (e) { console.error('symbol upload failed:', e.message); } }
  else if ('symbol_url' in b) patch.symbol_url = b.symbol_url;
  const { data, error } = await sb.from('candidates').update(patch).eq('id', params.id).select().maybeSingle();
  if (error) return fail('UPDATE_FAILED', 500, { message: error.message });
  await logAudit({ action: 'CANDIDATE_UPDATED', actor: admin.username, details: data?.name || params.id, ip: clientIp(req) });
  return ok({ candidate: data });
}
export async function DELETE(req, props) {
  const params = await props.params;
  const { admin, res } = await requireAdmin(req);if (res) return res;
  const sb = supabaseAdmin();
  const { error } = await sb.from('candidates').delete().eq('id', params.id);
  if (error) return fail('DELETE_FAILED', 500, { message: error.message });
  await logAudit({ action: 'CANDIDATE_DELETED', actor: admin.username, details: params.id, ip: clientIp(req) });
  return ok({});
}
