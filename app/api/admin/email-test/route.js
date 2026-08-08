import { ok, fail, readJson } from '@/lib/api';
import { requireSuperAdmin } from '@/lib/guard';
import { getTransport, fromAddress, sendNotice } from '@/lib/mailer';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * SMTP diagnostics. Super-admin only — it reveals configuration and can send.
 *
 *   GET                      → report config + verify the SMTP handshake
 *   POST { to: "a@b.com" }   → actually send a branded test email
 *
 * The point of separating the two: `verify()` proves the credentials and the
 * connection work without consuming any of Gmail's 500/day quota. Only send a
 * real message once verify passes.
 */

function mask(v) {
  if (!v) return null;
  if (v.length <= 4) return '••••';
  return `${v.slice(0, 2)}••••${v.slice(-2)} (len ${v.length})`;
}

function config() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  return {
    OTP_PROVIDER: process.env.OTP_PROVIDER || '(unset)',
    SMTP_HOST: host || '❌ MISSING',
    SMTP_PORT: port,
    SMTP_USER: user || '❌ MISSING',
    SMTP_PASS: pass ? mask(pass) : '❌ MISSING',
    SMTP_FROM: fromAddress() || '❌ MISSING',
    // A Gmail app password is 16 characters with the spaces removed. Leaving
    // the spaces in is the single most common cause of "Invalid login".
    passHasSpaces: pass ? /\s/.test(pass) : null,
    passLooksLikeAppPassword: pass ? pass.replace(/\s/g, '').length === 16 : null,
    secureMode: port === 465 ? 'implicit TLS' : 'STARTTLS',
  };
}

/** Turn nodemailer's terse errors into something actionable. */
function explain(e) {
  const m = String(e?.message || e);
  if (e?.notConfigured) return 'Environment variables are not set on this deployment.';
  if (/Invalid login|535|BadCredentials/i.test(m))
    return 'Credentials rejected. For Gmail you must use a 16-character App Password (2-Step Verification enabled), not your normal password. Remove any spaces.';
  if (/ETIMEDOUT|ECONNREFUSED|ENOTFOUND/i.test(m))
    return 'Could not reach the SMTP server. Check SMTP_HOST and SMTP_PORT.';
  if (/self.signed|certificate/i.test(m))
    return 'TLS certificate problem — check the host name matches the certificate.';
  if (/Daily user sending (limit|quota) exceeded|550.*5\.4\.5/i.test(m))
    return 'Gmail daily sending limit reached (500/day on a free account). Wait 24h or move to a transactional provider.';
  return m;
}

export async function GET(req) {
  const { res } = requireSuperAdmin(req);
  if (res) return res;

  const cfg = config();

  try {
    const transport = await getTransport();
    await transport.verify();
    return ok({
      config: cfg,
      smtp: 'connected',
      message: 'SMTP credentials are valid. POST to this endpoint with { "to": "you@example.com" } to send a real test email.',
    });
  } catch (e) {
    return ok({
      config: cfg,
      smtp: 'failed',
      error: explain(e),
      raw: String(e?.message || e),
    });
  }
}

export async function POST(req) {
  const { admin, res } = requireSuperAdmin(req);
  if (res) return res;

  const body = await readJson(req);
  const to = String(body.to || '').trim();

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to))
    return fail('INVALID_EMAIL', 400, { message: 'Provide a valid "to" address.' });

  try {
    await sendNotice({
      to,
      subject: 'TNR — email test',
      heading: 'Email is working',
      body:
        `This is a test message from the Tehreek-e-Nojawanan Roundu website.\n\n` +
        `If you are reading this, SMTP is configured correctly and OTP codes, ` +
        `membership invitations and notices will reach members.\n\n` +
        `Sent by: ${admin?.username || 'admin'}\n` +
        `Time: ${new Date().toISOString()}`,
      ctaText: 'Open the site',
      ctaUrl: 'https://www.mytnr.org',
    });

    return ok({ sent: true, to, from: fromAddress() });
  } catch (e) {
    return fail('SEND_FAILED', 500, {
      message: explain(e),
      raw: String(e?.message || e),
    });
  }
}
