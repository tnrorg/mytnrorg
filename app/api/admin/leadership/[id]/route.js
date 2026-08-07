import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAdmin } from '@/lib/guard';
import { uploadDataUrl } from '@/lib/storage';
import { logAudit, clientIp } from '@/lib/audit';
import { ok, fail, readJson } from '@/lib/api';
export const dynamic = 'force-dynamic';

const toArray = (v) => Array.isArray(v)
  ? v.map(x => String(x).trim()).filter(Boolean)
  : String(v || '').split('\n').map(x => x.trim()).filter(Boolean);

export async function PATCH(req, { params }) {
  const { admin, res } = requireAdmin(req); if (res) return res;
  const b = await readJson(req);
  const patch = { updated_at: new Date().toISOString() };
  // `body` is editable so a profile saved under the wrong tab can be moved
  // rather than deleted and retyped.
  for (const f of ['name', 'designation', 'qualification', 'field', 'affiliation', 'summary',
                   'slug', 'active', 'body', 'country', 'profession', 'organisation', 'tagline',
                   'intro', 'bio', 'email', 'mobile', 'cv_url'])
    if (f in b) patch[f] = b[f];
  // Booleans are coerced so an absent value can never accidentally publish a
  // contact detail or grant a verified badge.
  for (const f of ['show_email', 'show_mobile', 'verified', 'cv_approved', 'accepts_guidance'])
    if (f in b) patch[f] = b[f] === true;
  if ('expertise' in b) patch.expertise = toArray(b.expertise);
  if ('duties' in b) patch.duties = toArray(b.duties);
  if ('skills' in b) patch.skills = toArray(b.skills);
  if ('research_areas' in b) patch.research_areas = toArray(b.research_areas);
  if ('sort_order' in b) patch.sort_order = Number(b.sort_order) || 0;
  if (b.photo_data) {
    try { patch.photo_url = await uploadDataUrl(b.photo_data, 'leadership'); }
    catch (e) { return fail('UPLOAD_FAILED', 500, { message: 'Photo upload failed: ' + e.message }); }
  } else if ('photo_url' in b) patch.photo_url = b.photo_url;

  const { data, error } = await supabaseAdmin().from('leadership_profiles')
    .update(patch).eq('id', params.id).select().maybeSingle();
  if (error) return fail('UPDATE_FAILED', 500, { message: error.message });
  await logAudit({ action: 'LEADERSHIP_UPDATED', actor: admin.username, details: data?.name || data?.designation || params.id, ip: clientIp(req) });
  return ok({ profile: data });
}

export async function DELETE(req, { params }) {
  const { admin, res } = requireAdmin(req); if (res) return res;
  const { error } = await supabaseAdmin().from('leadership_profiles').delete().eq('id', params.id);
  if (error) return fail('DELETE_FAILED', 500, { message: error.message });
  await logAudit({ action: 'LEADERSHIP_DELETED', actor: admin.username, details: params.id, ip: clientIp(req) });
  return ok({});
}
