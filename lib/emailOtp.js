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

  const subject = 'Your TNR Election Verification Code';
  const text =
    `TEHREEK-E-NOJAWANAN ROUNDU\n\nYour election verification code is: ${code}\n\nThis code expires in 5 minutes. Do not share it with anyone.`;
  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:auto;border:1px solid #eee;border-radius:16px;overflow:hidden">
    <div style="background:#063D2B;color:#fff;padding:20px 24px;text-align:center">
      <div style="font-size:14px;letter-spacing:2px;color:#D4A72C;font-weight:700">TEHREEK-E-NOJAWANAN ROUNDU</div>
      <div style="font-size:13px;opacity:.8;margin-top:4px">Election Verification</div>
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
