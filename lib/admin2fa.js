import crypto from 'crypto';
import { supabaseAdmin } from './supabaseServer';
import { secretBytes, verifyCode, consumeBackupCode, hashBackupCode } from './totp';

/* The half-signed state between "password was right" and "signed in".
 *
 * The important property of this file is what a challenge token is NOT. It is
 * not a session: it carries no role, it is not accepted by `getAdmin`, and the
 * only endpoint that will look at it is the one that finishes the sign-in. A
 * correct password now buys an attacker a token that can do nothing except be
 * presented alongside a code they do not have.
 *
 * It lives in the database rather than in a short JWT so that it can be
 * *consumed* — a stateless token cannot be revoked the moment it is used, and
 * an unusable-once token is the whole point.
 */

export const CHALLENGE_TTL_MINUTES = 10;
export const MAX_CHALLENGE_ATTEMPTS = 6;

const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');

/** Opens a pending sign-in. Returns the raw token — stored only as a hash. */
export async function createChallenge(adminId, { ip, userAgent } = {}) {
  const raw = crypto.randomBytes(32).toString('base64url');
  const { error } = await supabaseAdmin().from('admin_2fa_challenges').insert({
    admin_id: adminId,
    token_hash: sha256(raw),
    ip: ip || null,
    user_agent: (userAgent || '').slice(0, 300) || null,
    expires_at: new Date(Date.now() + CHALLENGE_TTL_MINUTES * 60_000).toISOString(),
  });
  if (error) throw new Error(`challenge create failed: ${error.message}`);
  return raw;
}

/**
 * Look up a live challenge and the admin behind it.
 * Returns { challenge, admin } or null. Null covers every failure mode —
 * unknown, expired, already used — because the caller must not tell them apart
 * in a response.
 */
export async function loadChallenge(rawToken) {
  if (!rawToken) return null;
  const sb = supabaseAdmin();
  const { data: c } = await sb.from('admin_2fa_challenges')
    .select('*').eq('token_hash', sha256(rawToken)).maybeSingle();

  if (!c) return null;
  if (c.consumed_at) return null;
  if (new Date(c.expires_at).getTime() < Date.now()) return null;
  if (c.attempts >= MAX_CHALLENGE_ATTEMPTS) return null;

  const { data: admin } = await sb.from('admin_users')
    .select('*').eq('id', c.admin_id).maybeSingle();
  if (!admin) return null;

  return { challenge: c, admin };
}

export async function bumpAttempts(challengeId, current = 0) {
  await supabaseAdmin().from('admin_2fa_challenges')
    .update({ attempts: current + 1 }).eq('id', challengeId);
}

/** Marks a challenge spent. Called immediately before the session is issued. */
export async function consumeChallenge(challengeId) {
  await supabaseAdmin().from('admin_2fa_challenges')
    .update({ consumed_at: new Date().toISOString() }).eq('id', challengeId);
}

/**
 * Check one submitted code against every factor the admin has.
 *
 * Order matters only for clarity; all three are mutually exclusive in practice.
 * Returns { ok, method } — the method is recorded in the audit log, because
 * "signed in with a backup code" is worth being able to see later.
 */
export async function verifySecondFactor(admin, challenge, submitted) {
  const code = String(submitted || '').trim();
  if (!code) return { ok: false };

  // 1. Authenticator app
  const secret = secretBytes(admin.totp_secret_enc);
  if (secret) {
    const step = verifyCode(secret, code, { after: Number(admin.totp_last_step || 0) });
    if (step) {
      // Recording the step is what makes the code single-use. Without it the
      // same six digits work for the full 90-second window.
      await supabaseAdmin().from('admin_users')
        .update({ totp_last_step: step }).eq('id', admin.id);
      return { ok: true, method: 'app' };
    }
  }

  // 2. Emailed fallback code, if one was requested for this challenge
  if (challenge.email_code_hash) {
    const submittedHash = sha256(code.replace(/\D/g, ''));
    const a = Buffer.from(submittedHash), b = Buffer.from(challenge.email_code_hash);
    const fresh = challenge.email_sent_at &&
      Date.now() - new Date(challenge.email_sent_at).getTime() < 10 * 60_000;
    if (fresh && a.length === b.length && crypto.timingSafeEqual(a, b)) {
      return { ok: true, method: 'email' };
    }
  }

  // 3. Backup code — consumed on use, never reusable
  const remaining = consumeBackupCode(code, admin.backup_codes || []);
  if (remaining) {
    await supabaseAdmin().from('admin_users')
      .update({ backup_codes: remaining }).eq('id', admin.id);
    return { ok: true, method: 'backup', backupCodesLeft: remaining.length };
  }

  return { ok: false };
}

/** Stores the hash of an emailed code against the challenge. */
export async function attachEmailCode(challengeId, code) {
  await supabaseAdmin().from('admin_2fa_challenges').update({
    email_code_hash: sha256(String(code).replace(/\D/g, '')),
    email_sent_at: new Date().toISOString(),
  }).eq('id', challengeId);
}

/** True when this account must pass a second factor. */
export function twoFactorRequired(admin) {
  return !!(admin?.totp_enabled && admin?.totp_secret_enc);
}

/**
 * Super admins are required to enrol; everyone else may opt in.
 *
 * Kept here rather than inline so the login route, the guard and the UI all
 * read the same rule — a policy that is written down three times is a policy
 * that will disagree with itself.
 */
export function mustEnrol(admin) {
  const role = admin?.role;
  const isSuper = role === 'super_admin' || role === 'superadmin';
  return isSuper && !twoFactorRequired(admin);
}

export { hashBackupCode };
