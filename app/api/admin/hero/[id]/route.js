import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAdmin } from '@/lib/guard';
import { uploadDataUrl } from '@/lib/storage';
import { logAudit, clientIp } from '@/lib/audit';
import { ok, fail, readJson } from '@/lib/api';
import { slideFromBody } from '@/lib/heroSlides';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const HINT = 'Run supabase/migration_hero_slides.sql in the Supabase SQL Editor.';

export async function PATCH(req, { params }) {
  const { admin, res } = requireAdmin(req); if (res) return res;
  const b = await readJson(req);

  // Partial: only the fields actually sent are written, so toggling a slide on
  // or off cannot wipe its text or font sizes.
  const patch = { ...slideFromBody(b, { partial: true }), updated_at: new Date().toISOString() };

  if (b.image_data) {
    try { patch.image_url = await uploadDataUrl(b.image_data, 'hero'); }
    catch (e) { return fail('UPLOAD_FAILED', 500, { message: 'Image upload failed: ' + e.message }); }
  } else if ('image_url' in b) {
    patch.image_url = b.image_url || null;   // explicit null clears it
  }

  const { data, error } = await supabaseAdmin().from('hero_slides')
    .update(patch).eq('id', params.id).select().maybeSingle();
  if (error) return fail('SAVE_FAILED', 500, { message: error.message, hint: HINT });
  if (!data) return fail('NOT_FOUND', 404, { message: 'Slide not found.' });

  await logAudit({
    action: 'HERO_SLIDE_UPDATED', actor: admin.username,
    details: data.title || '(no headline)', ip: clientIp(req),
  });
  return ok({ slide: data, message: 'Saved.' });
}

export async function DELETE(req, { params }) {
  const { admin, res } = requireAdmin(req); if (res) return res;
  const sb = supabaseAdmin();

  const { data: before } = await sb.from('hero_slides').select('title').eq('id', params.id).maybeSingle();
  const { error } = await sb.from('hero_slides').delete().eq('id', params.id);
  if (error) return fail('DELETE_FAILED', 500, { message: error.message, hint: HINT });

  await logAudit({
    action: 'HERO_SLIDE_DELETED', actor: admin.username,
    details: before?.title || params.id, ip: clientIp(req),
  });
  return ok({ message: 'Slide deleted.' });
}
