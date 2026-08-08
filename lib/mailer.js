// Generic branded SMTP sender — reuses the same SMTP credentials as the OTP email.
// Server-only.
let cached = null;
export async function getTransport() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) {
    const e = new Error('Email SMTP not configured (SMTP_HOST / SMTP_USER / SMTP_PASS).');
    e.notConfigured = true; throw e;
  }
  if (cached) return cached;
  const nodemailer = (await import('nodemailer')).default;
  cached = nodemailer.createTransport({
    host, port, secure: port === 465, auth: { user, pass },
    pool: true, maxConnections: 3, maxMessages: 50,
  });
  return cached;
}

export function fromAddress() {
  const user = process.env.SMTP_USER;
  return process.env.SMTP_FROM || (user ? `Tehreek-e-Nojawanan Roundu <${user}>` : '');
}

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ─── Email branding, editable from the admin panel ───────────────────────────
// The header used to hardcode "Election Portal". Elections are one module of
// the platform, so that line was wrong on membership invitations, OTP codes and
// general notices — most of the mail the site actually sends.
//
// Values live in `membership_settings` (key/value) so an admin can change them
// without a redeploy. Cached for a minute: a bulk send is hundreds of renders
// and none of them should hit the database.
export const BRAND_DEFAULTS = {
  email_brand_title: 'TEHREEK-E-NOJAWANAN ROUNDU',
  email_brand_subtitle: 'Digital Community Platform',
  email_footer_note: 'You are receiving this because you are a registered member of TNR.',
};

let brandCache = null;
let brandCachedAt = 0;
const BRAND_TTL = 60_000;

export async function getBrand() {
  if (brandCache && Date.now() - brandCachedAt < BRAND_TTL) return brandCache;
  const out = { ...BRAND_DEFAULTS };
  try {
    const { supabaseAdmin } = await import('./supabaseServer');
    const { data } = await supabaseAdmin()
      .from('membership_settings')
      .select('key, value')
      .in('key', Object.keys(BRAND_DEFAULTS));
    for (const r of data || []) {
      if (r.value && String(r.value).trim()) out[r.key] = String(r.value).trim();
    }
  } catch {
    // Missing table or a database blip must never stop an email going out —
    // fall through to the defaults.
  }
  brandCache = out;
  brandCachedAt = Date.now();
  return out;
}

/** Called by the admin API after a save so the change shows immediately. */
export function clearBrandCache() { brandCache = null; brandCachedAt = 0; }

// Wraps plain text in the TNR-branded email shell. Supports {{name}} / {{member_code}} tokens.
// `brand` is optional — callers that already awaited getBrand() pass it in;
// everyone else gets the defaults, so no existing caller breaks.
export function renderNotice({ heading, body, footerNote, ctaText, ctaUrl, brand }) {
  const B = { ...BRAND_DEFAULTS, ...(brand || {}) };
  const paragraphs = String(body || '').split(/\n{2,}/)
    .map(p => `<p style="margin:0 0 14px;line-height:1.65;color:#333;font-size:14px">${esc(p).replace(/\n/g, '<br/>')}</p>`)
    .join('');
  const cta = ctaText && ctaUrl
    ? `<div style="text-align:center;margin:24px 0 4px">
         <a href="${esc(ctaUrl)}" style="display:inline-block;background:#063D2B;color:#F3E4B3;text-decoration:none;padding:13px 30px;border-radius:12px;font-weight:700;font-size:14px">${esc(ctaText)}</a>
       </div>` : '';
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:auto;border:1px solid #eee;border-radius:16px;overflow:hidden">
    <div style="background:#063D2B;color:#fff;padding:22px 24px;text-align:center">
      <div style="font-size:13px;letter-spacing:2px;color:#D4A72C;font-weight:700">${esc(B.email_brand_title)}</div>
      <div style="font-size:12px;opacity:.75;margin-top:4px">${esc(B.email_brand_subtitle)}</div>
    </div>
    <div style="padding:26px 24px;color:#15231D">
      ${heading ? `<h2 style="margin:0 0 14px;font-size:19px;color:#063D2B">${esc(heading)}</h2>` : ''}
      ${paragraphs}
      ${cta}
    </div>
    <div style="background:#FAFAFA;padding:14px 24px;text-align:center;color:#aaa;font-size:11px">
      ${esc(footerNote || B.email_footer_note)}
    </div>
  </div>`;
}

export function fillTokens(text, member) {
  return String(text || '')
    .replace(/\{\{\s*name\s*\}\}/gi, member?.full_name || 'Member')
    .replace(/\{\{\s*member_code\s*\}\}/gi, member?.member_code || '')
    .replace(/\{\{\s*village\s*\}\}/gi, member?.village || '');
}

export async function sendNotice({ to, subject, heading, body, ctaText, ctaUrl }) {
  const transport = await getTransport();
  const brand = await getBrand();
  const html = renderNotice({ heading, body, ctaText, ctaUrl, brand });
  const text = `${brand.email_brand_title}\n${brand.email_brand_subtitle}\n\n${heading ? heading + '\n\n' : ''}${body}${ctaUrl ? `\n\n${ctaText || 'Open'}: ${ctaUrl}` : ''}`;
  await transport.sendMail({ from: fromAddress(), to, subject, text, html });
}
