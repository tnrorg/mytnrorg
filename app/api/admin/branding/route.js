import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAdmin } from '@/lib/guard';
import { logAudit, clientIp } from '@/lib/audit';
import { ok, fail, readJson } from '@/lib/api';
import { BRAND_DEFAULTS, clearBrandCache } from '@/lib/mailer';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Email branding — the header lines that appear on every message the site
 * sends (OTP codes, membership invitations, notices).
 *
 * Stored in `membership_settings` as key/value so changing the wording is an
 * admin action, not a code change and redeploy.
 */
const FIELDS = Object.keys(BRAND_DEFAULTS);

const LIMITS = {
  email_brand_title: 60,
  email_brand_subtitle: 60,
  email_footer_note: 200,
};

export async function GET(req) {
  const { res } = requireAdmin(req);
  if (res) return res;

  try {
    const { data, error } = await supabaseAdmin()
      .from('membership_settings')
      .select('key, value')
      .in('key', FIELDS);

    if (error) return ok({ branding: { ...BRAND_DEFAULTS }, defaults: BRAND_DEFAULTS, stored: false });

    const branding = { ...BRAND_DEFAULTS };
    for (const r of data || []) {
      if (r.value && String(r.value).trim()) branding[r.key] = String(r.value).trim();
    }
    return ok({ branding, defaults: BRAND_DEFAULTS, stored: (data || []).length > 0 });
  } catch (e) {
    return ok({ branding: { ...BRAND_DEFAULTS }, defaults: BRAND_DEFAULTS, stored: false });
  }
}

export async function PATCH(req) {
  const { admin, res } = requireAdmin(req);
  if (res) return res;

  const b = await readJson(req);
  const rows = [];

  for (const key of FIELDS) {
    if (!(key in b)) continue;
    const value = String(b[key] ?? '').trim();
    if (value.length > LIMITS[key])
      return fail('TOO_LONG', 400, {
        message: `${key} must be ${LIMITS[key]} characters or fewer.`,
      });
    // An empty value means "revert to the built-in default" — storing the empty
    // string would render a blank line in the email header.
    rows.push({ key, value: value || null, updated_by: admin?.username || 'admin' });
  }

  if (!rows.length) return fail('NOTHING_TO_SAVE', 400, { message: 'No branding fields supplied.' });

  const { error } = await supabaseAdmin()
    .from('membership_settings')
    .upsert(rows, { onConflict: 'key' });

  if (error)
    return fail('SAVE_FAILED', 500, {
      message: 'Could not save branding.',
      detail: error.message,
      hint: 'If this mentions a missing table, run supabase/migration_membership_phase1.sql.',
    });

  clearBrandCache();
  await logAudit({
    action: 'EMAIL_BRANDING_UPDATED',
    actor: admin?.username || 'admin',
    details: rows.map(r => `${r.key}=${r.value ?? '(default)'}`).join(', '),
    ip: clientIp(req),
  });

  const branding = { ...BRAND_DEFAULTS };
  for (const r of rows) if (r.value) branding[r.key] = r.value;
  return ok({ branding, saved: true });
}
