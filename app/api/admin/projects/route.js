import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAdmin } from '@/lib/guard';
import { uploadDataUrl } from '@/lib/storage';
import { logAudit, clientIp } from '@/lib/audit';
import { ok, fail, readJson } from '@/lib/api';
import { projectFromBody } from '@/lib/projectWrite';
import { resolveGallery } from '@/lib/gallery';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const HINT = 'Run supabase/migration_projects_v2.sql in the Supabase SQL Editor.';

export async function GET(req) {
  const { res } = requireAdmin(req); if (res) return res;
  const { data, error } = await supabaseAdmin().from('tnr_projects')
    .select('*').order('sort_order').order('created_at', { ascending: false });
  if (error) return fail('READ_FAILED', 500, { message: error.message, hint: HINT });
  return ok({ projects: data || [] });
}

export async function POST(req) {
  const { admin, res } = requireAdmin(req); if (res) return res;
  const b = await readJson(req);
  if (!String(b.title || '').trim()) {
    return fail('MISSING', 400, { message: 'Give the project a title.' });
  }

  const row = projectFromBody(b);
  row.image_url = b.image_url || null;
  try {
    if (b.image_data) row.image_url = await uploadDataUrl(b.image_data, 'projects');
    row.gallery = await resolveGallery(b, uploadDataUrl, 'projects');
  } catch (e) {
    return fail('UPLOAD_FAILED', 500, { message: 'Image upload failed: ' + e.message });
  }

  const { data, error } = await supabaseAdmin().from('tnr_projects').insert(row).select().maybeSingle();
  if (error) return fail('SAVE_FAILED', 500, { message: error.message, hint: HINT });

  await logAudit({ action: 'PROJECT_ADDED', actor: admin.username, details: data?.title || '', ip: clientIp(req) });
  return ok({ project: data, message: 'Project added.' });
}
