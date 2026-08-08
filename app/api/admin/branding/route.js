import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAdmin } from '@/lib/guard';
import { logAudit, clientIp } from '@/lib/audit';
import { ok, fail, readJson } from '@/lib/api';
import { BRAND_DEFAULTS, clearBrandCache } from '@/lib/mailer';
import { HEADER_DEFAULTS } from '@/lib/siteHeader';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Email branding — the header lines that appear on every message the site
 * sends (OTP codes, membership invitations, notices).
 *
 * Stored in `membership_settings` as key/value so changing the wording is an
 * admin action, not a code change and redeploy.
 */
const ALL_DEFAULTS = { ...BRAND_DEFAULTS, ...HEADER_DEFAULTS };
const FIELDS = Object.keys(ALL_DEFAULTS);

const LIMITS = {
  email_brand_title: 60,
  email_brand_subtitle: 60,
  email_footer_note: 200,
  header_tagline: 120,
  social_facebook: 300, social_instagram: 300, social_youtube: 300,
  social_linkedin: 300, social_twitter: 300, social_whatsapp: 300,
};

// Social links may legitimately be blank — that hides the icon. The email
// fields may not: a blank there means "use the built-in default".
const BLANKABLE = new Set(Object.keys(HEADER_DEFAULTS).filter(k => k !== 'header_tagline'));

export async function GET(req) {
  const { res } = requireAdmin(req);
  if (res) return res;

  try {
    const { data, error } = await supabaseAdmin()
      .from('membership_settings')
      .select('key, value')
      .in('key', FIELDS);

    if (error) return ok({ branding: { ...ALL_DEFAULTS }, defaults: ALL_DEFAULTS, stored: false });

    const branding = { ...ALL_DEFAULTS };
    for (const r of data || []) {
      // A stored empty string is meaningful for social links (hidden), so it
      // must overwrite the default rather than be skipped as falsy.
      if (r.value != null) branding[r.key] = String(r.value);
    }
    return ok({ branding, defaults: ALL_DEFAULTS, stored: (data || []).length > 0 });
  } catch (e) {
    return ok({ branding: { ...ALL_DEFAULTS }, defaults: ALL_DEFAULTS, stored: false });
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
    // Blank handling differs by field. For a social link, blank means "we do
    // not have this account — hide the icon", so the empty string is stored.
    // For an email heading, blank means "use the built-in default", so null is
    // stored and the default applies at render time.
    rows.push({
      key,
      value: value === '' ? (BLANKABLE.has(key) ? '' : null) : value,
      updated_by: admin?.username || 'admin',
    });
  }

  if (!rows.length) return fail('NOTHING_TO_SAVE', 400, { message: 'No settings supplied.' });

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
    action: 'SITE_BRANDING_UPDATED',
    actor: admin?.username || 'admin',
    details: rows.map(r => `${r.key}=${r.value ?? '(default)'}`).join(', '),
    ip: clientIp(req),
  });

  const branding = { ...ALL_DEFAULTS };
  for (const r of rows) if (r.value != null) branding[r.key] = r.value;
  return ok({ branding, saved: true });
}
