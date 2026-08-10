import { supabaseAdmin } from '@/lib/supabaseServer';
import { verifyPassword, signAdmin } from '@/lib/auth';
import { logAudit, clientIp } from '@/lib/audit';
import { ok, fail, readJson } from '@/lib/api';
import { checkLoginAllowed, recordLoginFailure, clearLoginFailures, lockoutMessage } from '@/lib/loginGuard';
import { verifyTurnstile } from '@/lib/turnstile';
import { createChallenge, twoFactorRequired, mustEnrol } from '@/lib/admin2fa';
export const dynamic = 'force-dynamic';
export async function POST(req) {
  const { username, password, turnstileToken } = await readJson(req);
  if (!username || !password) return fail('MISSING', 400, { message: 'Username and password required.' });
  const ip = clientIp(req);

  // Lockout is checked before anything else, so a locked account costs an
  // attacker one cheap query rather than a bcrypt comparison.
  const gate = await checkLoginAllowed('admin', { username, ip });
  if (gate.blocked) {
    await logAudit({ action: 'ADMIN_LOGIN_BLOCKED', actor: String(username), ip });
    return fail('RATE_LIMITED', 429, { message: lockoutMessage(gate.retryAfter) });
  }

  const captcha = await verifyTurnstile(turnstileToken, ip);
  if (!captcha.ok) return fail('CAPTCHA_FAILED', 400, { message: captcha.reason });

  const sb = supabaseAdmin();
  const { data: admin } = await sb.from('admin_users').select('*').eq('username', username).maybeSingle();
  if (!admin || !(await verifyPassword(password, admin.password_hash))) {
    await recordLoginFailure('admin', { username, ip });
    await logAudit({ action: 'ADMIN_LOGIN_FAILED', actor: String(username), ip });
    return fail('BAD_CREDENTIALS', 401, { message: 'Invalid username or password.' });
  }

  await clearLoginFailures('admin', { username, ip });

  /* ── second factor ────────────────────────────────────────────────────────
   * The password is correct, and on an account with 2FA enabled that is
   * deliberately not enough to be signed in. No session token is minted here.
   * What comes back instead is a challenge: a random value that is accepted by
   * one endpoint, expires in ten minutes, and is destroyed the moment it is
   * used. Someone holding a stolen or guessed password reaches exactly this
   * point and no further.
   *
   * `mustEnrol` is separate: a super admin who has never set up 2FA is still
   * signed in, but the response says the account is not compliant and the UI
   * routes them into setup. Locking them out of their own dashboard to enforce
   * a control they cannot yet satisfy would be a lockout, not a safeguard. */
  if (twoFactorRequired(admin)) {
    let challengeToken;
    try {
      challengeToken = await createChallenge(admin.id, {
        ip, userAgent: req.headers.get('user-agent') || '',
      });
    } catch (e) {
      // Almost always the migration has not been run. Say so rather than
      // failing open — an unexplained error here must never become a sign-in.
      console.error('[admin login] challenge create failed:', e.message);
      return fail('SERVER_MISCONFIGURED', 500, {
        message: 'Two-factor sign-in is unavailable. An administrator needs to run ' +
          'supabase/migration_admin_2fa.sql.',
      });
    }
    await logAudit({ action: 'ADMIN_LOGIN_2FA_PENDING', actor: admin.username, ip });
    return ok({
      twoFactorRequired: true,
      challengeToken,
      // Told to the client only so the UI knows whether to offer the fallback
      // link. It reveals nothing an attacker at this point does not already
      // have, and hiding it produces a dead-end for a locked-out admin.
      emailFallbackAvailable: !!admin.email,
      hint: admin.email ? maskEmail(admin.email) : null,
    });
  }

  /* Signing can fail for exactly one reason: JWT_SECRET is missing or too
   * short, and jwtSecret() refuses to mint a token rather than fall back to a
   * weak key. Left unhandled that surfaced as a bare "server returned 500" on
   * the sign-in form — correct behaviour, useless message. The real cause is
   * named here so the fix is one look at the environment variables rather than
   * a hunt through the function logs. The secret itself is never echoed. */
  let token;
  try {
    token = signAdmin(admin);
  } catch (e) {
    console.error('[admin login] token signing failed:', e.message);
    return fail('SERVER_MISCONFIGURED', 500, {
      message: 'Sign-in is unavailable: the server is missing its security configuration. ' +
        'An administrator needs to set JWT_SECRET in the deployment environment.',
    });
  }
  await logAudit({ action: 'ADMIN_LOGIN', actor: admin.username, ip });
  // The role stays out of the response body — the client asks /api/admin/me instead.
  return ok({
    token,
    admin: { id: admin.id, username: admin.username, full_name: admin.full_name },
    // Signals the UI to open the setup wizard. Not a permission — the real
    // enforcement is in requireAdmin2FA on the server.
    enrolRequired: mustEnrol(admin),
  });
}

/** j***@gmail.com — enough for the admin to recognise, not enough to harvest. */
function maskEmail(email) {
  const [user, domain] = String(email).split('@');
  if (!domain) return null;
  const head = user.slice(0, 1);
  return `${head}${'*'.repeat(Math.max(3, user.length - 1))}@${domain}`;
}
