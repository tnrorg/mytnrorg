import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAdmin } from '@/lib/guard';
import { uploadDataUrl } from '@/lib/storage';
import { logAudit, clientIp } from '@/lib/audit';
import { ok, fail, readJson } from '@/lib/api';
import { institutionFromBody } from '@/lib/institutionWrite';
import { resolveGallery } from '@/lib/gallery';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const HINT = 'Run supabase/migration_institutions.sql in the Supabase SQL Editor.';

export async function PATCH(req, props) {
  const params = await props.params;
  const { admin, res } = await requireAdmin(req);if (res) return res;
  const b = await readJson(req);

  // Partial: publishing or hiding cannot blank out the staffing figures.
  const patch = { ...institutionFromBody(b, { partial: true }), updated_at: new Date().toISOString() };

  try {
    if (b.image_data) patch.image_url = await uploadDataUrl(b.image_data, 'institutions');
    else if ('image_url' in b) patch.image_url = b.image_url || null;

    if ('gallery' in b || 'gallery_add' in b) {
      patch.gallery = await resolveGallery(b, uploadDataUrl, 'institutions');
    }
  } catch (e) {
    return fail('UPLOAD_FAILED', 500, { message: 'Image upload failed: ' + e.message });
  }

  const { data, error } = await supabaseAdmin().from('tnr_institutions')
    .update(patch).eq('id', params.id).select().maybeSingle();
  if (error) return fail('SAVE_FAILED', 500, { message: error.message, hint: HINT });
  if (!data) return fail('NOT_FOUND', 404, { message: 'Institution not found.' });

  await logAudit({ action: 'INSTITUTION_UPDATED', actor: admin.username, details: data.name || '', ip: clientIp(req) });
  return ok({ institution: data, message: 'Saved.' });
}

export async function DELETE(req, props) {
  const params = await props.params;
  const { admin, res } = await requireAdmin(req);if (res) return res;
  const sb = supabaseAdmin();

  const { data: before } = await sb.from('tnr_institutions').select('name').eq('id', params.id).maybeSingle();
  const { error } = await sb.from('tnr_institutions').delete().eq('id', params.id);
  if (error) return fail('DELETE_FAILED', 500, { message: error.message, hint: HINT });

  await logAudit({ action: 'INSTITUTION_DELETED', actor: admin.username, details: before?.name || params.id, ip: clientIp(req) });
  return ok({ message: 'Deleted.' });
}
