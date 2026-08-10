import { signAdmin } from '@/lib/auth';
import { logAudit, clientIp } from '@/lib/audit';
import { ok, fail, readJson } from '@/lib/api';
import {
  throttle, lockoutMessage,
  checkLoginAllowed, recordLoginFailure, clearLoginFailures,
} from '@/lib/loginGuard';
import {
  loadChallenge, bumpAttempts, consumeChallenge,
  verifySecondFactor, mustEnrol, MAX_CHALLENGE_ATTEMPTS,
} from '@/lib/admin2fa';

export const dynamic = 'force-dynamic';

/* Step two of admin sign-in: exchange a challenge token plus a valid code for
 * a real session.
 *
 * This is the only endpoint in the application that mints an admin token
 * without a password, and it is the only one that will look at a challenge
 * token. Both facts are load-bearing.
 */
export async function POST(req) {
  const { challengeToken, code } = await readJson(req);
  const ip = clientIp(req);

  if (!challengeToken || !code)
    return fail('INVALID', 400, { message: 'Enter the 6-digit code from your authenticator app.' });

  /* Three limits, because two of them are individually escapable.
   *
   * A six-digit code is a million possibilities — enough only while guessing
   * is expensive, so the job here is to keep it expensive.
   *
   *   per challenge (6)  — cheap to escape: an attacker who already has the
   *                        password just starts another challenge and gets six
   *                        more. On its own this bounds nothing.
   *   per IP (30/15min)  — escapable with more machines.
   *   per ACCOUNT (5/15min via checkLoginAllowed) — the one that actually
   *                        binds. It follows the account being attacked rather
   *                        than where the traffic comes from, so a botnet buys
   *                        no extra guesses. Five per quarter hour is under
   *                        five hundred a day against a million codes.
   *
   * Layered because each covers a different attacker, and the cheap ones give
   * an honest admin a clearer message before the strict one bites. */
  const ipGate = await throttle('admin_2fa', ip, { max: 30, windowMinutes: 15, lockMinutes: 30 });
  if (ipGate.blocked) return fail('RATE_LIMITED', 429, { message: lockoutMessage(ipGate.retryAfter) });

  const loaded = await loadChallenge(challengeToken);
  if (!loaded) {
    // Unknown, expired, spent or exhausted — all one message. Distinguishing
    // them would tell an attacker whether a token is real.
    return fail('CHALLENGE_INVALID', 401, {
      message: 'This sign-in has expired. Please enter your username and password again.',
      restart: true,
    });
  }
  const { challenge, admin } = loaded;

  // Now that the account is known, apply the limit that follows the account.
  const userGate = await checkLoginAllowed('admin_2fa', { username: admin.username, ip });
  if (userGate.blocked)
    return fail('RATE_LIMITED', 429, { message: lockoutMessage(userGate.retryAfter) });

  const result = await verifySecondFactor(admin, challenge, code);

  if (!result.ok) {
    await bumpAttempts(challenge.id, challenge.attempts);
    await recordLoginFailure('admin_2fa', { username: admin.username, ip });
    await logAudit({ action: 'ADMIN_2FA_FAILED', actor: admin.username, ip });
    const left = MAX_CHALLENGE_ATTEMPTS - (challenge.attempts + 1);
    return fail('BAD_CODE', 401, {
      message: left > 0
        ? `Incorrect code. ${left} attempt${left === 1 ? '' : 's'} remaining.`
        : 'Too many incorrect codes. Please sign in again.',
      restart: left <= 0,
    });
  }

  await clearLoginFailures('admin_2fa', { username: admin.username, ip });

  // Spend the challenge BEFORE issuing the token. If the process dies between
  // these two lines the admin re-enters their password — an inconvenience.
  // The other order would leave a used challenge replayable, which is not.
  await consumeChallenge(challenge.id);

  let token;
  try {
    token = signAdmin(admin);
  } catch (e) {
    console.error('[admin 2fa] token signing failed:', e.message);
    return fail('SERVER_MISCONFIGURED', 500, {
      message: 'Sign-in is unavailable: the server is missing its security configuration.',
    });
  }

  await logAudit({
    action: 'ADMIN_LOGIN',
    actor: admin.username,
    ip,
    // Which factor was used is worth keeping. A run of backup-code sign-ins is
    // either an admin who lost their phone or someone who found the printout.
    details: `2fa:${result.method}`,
  });

  return ok({
    token,
    admin: { id: admin.id, username: admin.username, full_name: admin.full_name },
    enrolRequired: mustEnrol(admin),
    // Surfaced so a dwindling supply is noticed before it runs out entirely.
    backupCodesLeft: result.backupCodesLeft,
    usedBackupCode: result.method === 'backup',
  });
}
