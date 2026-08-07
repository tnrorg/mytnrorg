import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAdmin } from '@/lib/guard';
import { uploadDataUrl } from '@/lib/storage';
import { logAudit, clientIp } from '@/lib/audit';
import { ok, fail, readJson } from '@/lib/api';
import { CARD_DEFAULTS } from '@/lib/cardDefaults';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const TEXT_FIELDS = [
  'org_line1', 'org_line2', 'card_label', 'signatory_title', 'signature_note',
  'footer_tagline', 'about_heading', 'about_text', 'benefits_heading',
  'website', 'email', 'phone', 'verify_label', 'scan_label',
];
const toArray = (v) => Array.isArray(v)
  ? v.map(x => String(x).trim()).filter(Boolean)
  : String(v || '').split('\n').map(x => x.trim()).filter(Boolean);

export async function GET(req) {
  const { res } = requireAdmin(req); if (res) return res;
  const { data, error } = await supabaseAdmin().from('card_settings').select('*').eq('id', 1).maybeSingle();
  if (error) return fail('READ_FAILED', 500, { message: error.message, hint: 'Run supabase/migration_card_settings.sql' });
  return ok({ settings: data || { id: 1, ...CARD_DEFAULTS } });
}

export async function PATCH(req) {
  const { admin, res } = requireAdmin(req); if (res) return res;
  const b = await readJson(req);
  const patch = { id: 1, updated_at: new Date().toISOString() };
  for (const f of TEXT_FIELDS) if (f in b) patch[f] = b[f];
  if ('benefits' in b) patch.benefits = toArray(b.benefits);
  if (b.signature_data) {
    try { patch.signature_url = await uploadDataUrl(b.signature_data, 'card'); }
    catch (e) { return fail('UPLOAD_FAILED', 500, { message: 'Signature upload failed: ' + e.message }); }
  } else if ('signature_url' in b) patch.signature_url = b.signature_url;

  const { data, error } = await supabaseAdmin().from('card_settings')
    .upsert(patch, { onConflict: 'id' }).select().maybeSingle();
  if (error) return fail('SAVE_FAILED', 500, { message: error.message, hint: 'Run supabase/migration_card_settings.sql' });
  await logAudit({ action: 'CARD_TEMPLATE_UPDATED', actor: admin.username, details: 'Membership card template', ip: clientIp(req) });
  return ok({ settings: data });
}
