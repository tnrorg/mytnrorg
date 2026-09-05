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

export async function GET(req) {
  const { res } = await requireAdmin(req); if (res) return res;
  const { data, error } = await supabaseAdmin().from('tnr_institutions')
    .select('*').order('sort_order').order('name');
  if (error) return fail('READ_FAILED', 500, { message: error.message, hint: HINT });
  return ok({ institutions: data || [] });
}

export async function POST(req) {
  const { admin, res } = await requireAdmin(req); if (res) return res;
  const b = await readJson(req);
  if (!String(b.name || '').trim()) {
    return fail('MISSING', 400, { message: 'Enter the name of the school or college.' });
  }

  const row = institutionFromBody(b);
  row.image_url = b.image_url || null;
  try {
    if (b.image_data) row.image_url = await uploadDataUrl(b.image_data, 'institutions');
    row.gallery = await resolveGallery(b, uploadDataUrl, 'institutions');
  } catch (e) {
    return fail('UPLOAD_FAILED', 500, { message: 'Image upload failed: ' + e.message });
  }

  const { data, error } = await supabaseAdmin().from('tnr_institutions').insert(row).select().maybeSingle();
  if (error) return fail('SAVE_FAILED', 500, { message: error.message, hint: HINT });

  await logAudit({ action: 'INSTITUTION_ADDED', actor: admin.username, details: data?.name || '', ip: clientIp(req) });
  return ok({ institution: data, message: 'Added.' });
}
