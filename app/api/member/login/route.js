import { supabaseAdmin } from '@/lib/supabaseServer';
import { ok, fail, readJson } from '@/lib/api';
import { normalizeEmail } from '@/lib/membership/core';
import { verifyPassword, signMemberToken, canLogin } from '@/lib/membership/auth';
import { clientIp } from '@/lib/audit';
import { checkLoginAllowed, recordLoginFailure, clearLoginFailures, lockoutMessage } from '@/lib/loginGuard';
import { verifyTurnstile } from '@/lib/turnstile';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  const b = await readJson(req);
  const email = normalizeEmail(b.email);
  const password = String(b.password || '');
  if (!email || !password) return fail('INVALID', 400, { message: 'Enter your email and password.' });

  const ip = clientIp(req);

  const gate = await checkLoginAllowed('member', { username: email, ip });
  if (gate.blocked) return fail('RATE_LIMITED', 429, { message: lockoutMessage(gate.retryAfter) });

  const captcha = await verifyTurnstile(b.turnstileToken, ip);
  if (!captcha.ok) return fail('CAPTCHA_FAILED', 400, { message: captcha.reason });

  const { data: rows } = await supabaseAdmin().from('membership_members')
    .select('*').eq('email_normalized', email).is('deleted_at', null).limit(1);
  const m = rows && rows[0];

  // Generic message — never reveal whether an email exists. The failure is
  // recorded either way, so probing for valid emails costs the same as
  // guessing a password and hits the same lockout.
  const bad = async () => {
    await recordLoginFailure('member', { username: email, ip });
    return fail('BAD_CREDENTIALS', 401, { message: 'Invalid email or password.' });
  };
  if (!m || !m.password_hash) return bad();
  if (!(await verifyPassword(password, m.password_hash))) return bad();

  await clearLoginFailures('member', { username: email, ip });

  if (!canLogin(m.status))
    return fail('ACCOUNT_BLOCKED', 403, {
      message: 'Your membership is not currently active. Please contact the membership committee.' });

  await supabaseAdmin().from('membership_members')
    .update({ last_login_at: new Date().toISOString() }).eq('id', m.id);

  // Same guard as the admin route: a missing JWT_SECRET must report itself
  // rather than surface as an unexplained 500 on the sign-in form.
  let token;
  try {
    token = signMemberToken(m);
  } catch (e) {
    console.error('[member login] token signing failed:', e.message);
    return fail('SERVER_MISCONFIGURED', 500, {
      message: 'Sign-in is temporarily unavailable. Please contact the membership committee.',
    });
  }

  return ok({
    token,
    member: { membership_id: m.membership_id, full_name: m.full_name, photo_url: m.photo_url },
  });
}
