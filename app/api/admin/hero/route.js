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

export async function GET(req) {
  const { res } = requireAdmin(req); if (res) return res;
  const { data, error } = await supabaseAdmin().from('hero_slides')
    .select('*').order('sort_order').order('created_at');
  if (error) return fail('READ_FAILED', 500, { message: error.message, hint: HINT });
  return ok({ slides: data || [] });
}

export async function POST(req) {
  const { admin, res } = requireAdmin(req); if (res) return res;
  const b = await readJson(req);

  if (!String(b.title || '').trim() && !b.image_data && !b.image_url) {
    return fail('MISSING', 400, { message: 'Give the slide a headline or a background image.' });
  }

  const row = slideFromBody(b);
  row.image_url = b.image_url || null;
  if (b.image_data) {
    try { row.image_url = await uploadDataUrl(b.image_data, 'hero'); }
    catch (e) { return fail('UPLOAD_FAILED', 500, { message: 'Image upload failed: ' + e.message }); }
  }

  // New slides go to the end unless the admin picked a position.
  if (!row.sort_order) {
    const { data: last } = await supabaseAdmin().from('hero_slides')
      .select('sort_order').order('sort_order', { ascending: false }).limit(1).maybeSingle();
    row.sort_order = (last?.sort_order || 0) + 1;
  }

  const { data, error } = await supabaseAdmin().from('hero_slides').insert(row).select().maybeSingle();
  if (error) return fail('SAVE_FAILED', 500, { message: error.message, hint: HINT });

  await logAudit({
    action: 'HERO_SLIDE_ADDED', actor: admin.username,
    details: data?.title || '(no headline)', ip: clientIp(req),
  });
  return ok({ slide: data, message: 'Slide added.' });
}
