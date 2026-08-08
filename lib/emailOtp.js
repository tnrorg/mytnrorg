// Sends the OTP by email over SMTP (free with Gmail app password, Brevo, SendGrid, etc.).
// Server-only. Configure via environment variables.
export async function sendEmailOtp(to, code) {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || (user ? `Tehreek-e-Nojawanan Roundu <${user}>` : '');
  if (!host || !user || !pass) {
    const e = new Error('Email SMTP not configured (SMTP_HOST / SMTP_USER / SMTP_PASS).');
    e.notConfigured = true; throw e;
  }
  const nodemailer = (await import('nodemailer')).default;
  const transport = nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } });

  // Branding comes from `membership_settings` so an admin can change it without
  // a redeploy. OTP codes are also used for member login, not just voting, so
  // "Election Verification" was wrong on most of these messages.
  const { getBrand } = await import('./mailer');
  const brand = await getBrand();
  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const subject = 'Your TNR Verification Code';
  const text =
    `${brand.email_brand_title}\n\nYour verification code is: ${code}\n\nThis code expires in 5 minutes. Do not share it with anyone.`;
  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:auto;border:1px solid #eee;border-radius:16px;overflow:hidden">
    <div style="background:#063D2B;color:#fff;padding:20px 24px;text-align:center">
      <div style="font-size:14px;letter-spacing:2px;color:#D4A72C;font-weight:700">${esc(brand.email_brand_title)}</div>
      <div style="font-size:13px;opacity:.8;margin-top:4px">${esc(brand.email_brand_subtitle)}</div>
    </div>
    <div style="padding:28px 24px;text-align:center;color:#15231D">
      <p style="margin:0 0 8px;color:#555">Your one-time verification code is</p>
      <div style="font-size:38px;font-weight:800;letter-spacing:10px;color:#063D2B">${code}</div>
      <p style="margin:16px 0 0;color:#888;font-size:13px">This code expires in <b>5 minutes</b>. Do not share it with anyone.</p>
    </div>
    <div style="background:#FAFAFA;padding:14px 24px;text-align:center;color:#aaa;font-size:11px">
      If you did not request this, you can ignore this email.
    </div>
  </div>`;
  await transport.sendMail({ from, to, subject, text, html });
  return { channel: 'email' };
}
