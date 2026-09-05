import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAdmin } from '@/lib/guard';
import { uploadDataUrl } from '@/lib/storage';
import { logAudit, clientIp } from '@/lib/audit';
import { ok, fail, readJson } from '@/lib/api';
import { CERT_DEFAULTS } from '@/lib/certificateDefaults';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const TEXT_FIELDS = [
  'org_line1', 'org_line2', 'cert_title', 'intro_line', 'body_text',
  'signatory_title', 'signatory_org', 'scan_label', 'issued_label',
  'accent_gold', 'accent_green',
];
const BOOL_FIELDS = ['show_border', 'show_qr'];

const isHex = (v) => /^#[0-9a-f]{6}$/i.test(String(v || ''));

export async function GET(req) {
  const { res } = await requireAdmin(req); if (res) return res;
  const { data, error } = await supabaseAdmin()
    .from('certificate_settings').select('*').eq('id', 1).maybeSingle();
  if (error) return fail('READ_FAILED', 500, {
    message: error.message,
    hint: 'Run supabase/migration_certificate_settings.sql',
  });
  return ok({ settings: data || { id: 1, ...CERT_DEFAULTS }, defaults: CERT_DEFAULTS });
}

export async function PATCH(req) {
  const { admin, res } = await requireAdmin(req); if (res) return res;
  const b = await readJson(req);
  const patch = { id: 1, updated_at: new Date().toISOString() };

  for (const f of TEXT_FIELDS) {
    if (!(f in b)) continue;
    const v = String(b[f] ?? '').trim();
    // Colours go straight into a style attribute — reject anything that is not
    // a plain hex value rather than letting arbitrary CSS through.
    if ((f === 'accent_gold' || f === 'accent_green') && v && !isHex(v))
      return fail('INVALID_COLOUR', 400, { message: `${f} must be a hex colour like #C9A227.` });
    patch[f] = v || CERT_DEFAULTS[f];
  }
  for (const f of BOOL_FIELDS) if (f in b) patch[f] = !!b[f];

  if (b.signature_data) {
    try { patch.signature_url = await uploadDataUrl(b.signature_data, 'certificates'); }
    catch (e) { return fail('UPLOAD_FAILED', 500, { message: 'Signature upload failed: ' + e.message }); }
  } else if ('signature_url' in b) patch.signature_url = b.signature_url || null;

  if (b.logo_data) {
    try { patch.logo_url = await uploadDataUrl(b.logo_data, 'certificates'); }
    catch (e) { return fail('UPLOAD_FAILED', 500, { message: 'Logo upload failed: ' + e.message }); }
  } else if ('logo_url' in b) patch.logo_url = b.logo_url || null;

  const { data, error } = await supabaseAdmin()
    .from('certificate_settings').upsert(patch, { onConflict: 'id' }).select().maybeSingle();
  if (error) return fail('SAVE_FAILED', 500, {
    message: error.message,
    hint: 'Run supabase/migration_certificate_settings.sql',
  });

  await logAudit({
    action: 'CERTIFICATE_TEMPLATE_UPDATED',
    actor: admin.username,
    details: 'Membership certificate template',
    ip: clientIp(req),
  });
  return ok({ settings: data });
}
