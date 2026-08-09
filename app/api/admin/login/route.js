import { supabaseAdmin } from '@/lib/supabaseServer';
import { verifyPassword, signAdmin } from '@/lib/auth';
import { logAudit, clientIp } from '@/lib/audit';
import { ok, fail, readJson } from '@/lib/api';
import { checkLoginAllowed, recordLoginFailure, clearLoginFailures, lockoutMessage } from '@/lib/loginGuard';
import { verifyTurnstile } from '@/lib/turnstile';
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
  return ok({ token, admin: { id: admin.id, username: admin.username, full_name: admin.full_name } });
}
