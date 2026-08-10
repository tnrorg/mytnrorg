import { clientIp, logAudit } from '@/lib/audit';
import { ok, fail, readJson } from '@/lib/api';
import { throttle, lockoutMessage } from '@/lib/loginGuard';
import { loadChallenge, attachEmailCode } from '@/lib/admin2fa';
import { generateOtp } from '@/lib/otp';
import { sendEmailOtp } from '@/lib/emailOtp';

export const dynamic = 'force-dynamic';

/* The "my phone is gone" path.
 *
 * Worth being clear about what this costs. An emailed code is a weaker factor
 * than an authenticator app: anyone inside the admin's mailbox can complete
 * the sign-in, so 2FA becomes only as strong as that mailbox. It is here
 * because the alternative — an admin permanently locked out of the platform —
 * reliably ends with 2FA being switched off altogether, and a weaker second
 * factor beats none.
 *
 * Backup codes are the better recovery route and the UI says so. This is the
 * fallback to the fallback.
 */
export async function POST(req) {
  const { challengeToken } = await readJson(req);
  const ip = clientIp(req);

  if (!challengeToken) return fail('INVALID', 400, { message: 'Sign in again.' });

  // Tighter than the code-checking limit: this one sends mail, so an
  // unthrottled endpoint is both a way to flood an inbox and a way to burn the
  // 500/day Gmail quota that member OTPs also depend on.
  const gate = await throttle('admin_2fa_email', ip, { max: 5, windowMinutes: 15, lockMinutes: 15 });
  if (gate.blocked) return fail('RATE_LIMITED', 429, { message: lockoutMessage(gate.retryAfter) });

  const loaded = await loadChallenge(challengeToken);
  if (!loaded) return fail('CHALLENGE_INVALID', 401, {
    message: 'This sign-in has expired. Please enter your username and password again.',
    restart: true,
  });
  const { challenge, admin } = loaded;

  if (!admin.email) {
    return fail('NO_EMAIL', 400, {
      message: 'No recovery email is set for this account. Use one of your backup codes instead.',
    });
  }

  // One code per minute per challenge — enough to cover a mail that has not
  // arrived yet, not enough to be used as a mail cannon.
  if (challenge.email_sent_at &&
      Date.now() - new Date(challenge.email_sent_at).getTime() < 60_000) {
    return fail('TOO_SOON', 429, {
      message: 'A code was just sent. Please wait a moment before requesting another.',
    });
  }

  const code = generateOtp();

  // Stored before sending. If the mail fails the admin gets an error and can
  // retry; if it were stored after, a slow send would race the person typing.
  await attachEmailCode(challenge.id, code);

  try {
    await sendEmailOtp(admin.email, code);
  } catch (e) {
    console.error('[admin 2fa email] send failed:', e.message);
    return fail('SEND_FAILED', 500, {
      message: e.notConfigured
        ? 'Email is not configured on this server. Use a backup code instead.'
        : 'The code could not be sent. Use a backup code instead.',
    });
  }

  await logAudit({ action: 'ADMIN_2FA_EMAIL_SENT', actor: admin.username, ip });
  return ok({ sent: true });
}
