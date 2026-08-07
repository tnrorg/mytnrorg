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

// Wraps plain text in the TNR-branded email shell. Supports {{name}} / {{member_code}} tokens.
export function renderNotice({ heading, body, footerNote, ctaText, ctaUrl }) {
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
      <div style="font-size:13px;letter-spacing:2px;color:#D4A72C;font-weight:700">TEHREEK-E-NOJAWANAN ROUNDU</div>
      <div style="font-size:12px;opacity:.75;margin-top:4px">Election Portal</div>
    </div>
    <div style="padding:26px 24px;color:#15231D">
      ${heading ? `<h2 style="margin:0 0 14px;font-size:19px;color:#063D2B">${esc(heading)}</h2>` : ''}
      ${paragraphs}
      ${cta}
    </div>
    <div style="background:#FAFAFA;padding:14px 24px;text-align:center;color:#aaa;font-size:11px">
      ${esc(footerNote || 'You are receiving this because you are a registered member of TNR.')}
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
  const html = renderNotice({ heading, body, ctaText, ctaUrl });
  const text = `TEHREEK-E-NOJAWANAN ROUNDU\n\n${heading ? heading + '\n\n' : ''}${body}${ctaUrl ? `\n\n${ctaText || 'Open'}: ${ctaUrl}` : ''}`;
  await transport.sendMail({ from: fromAddress(), to, subject, text, html });
}
