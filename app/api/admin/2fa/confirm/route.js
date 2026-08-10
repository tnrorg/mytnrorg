import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAdmin } from '@/lib/guard';
import { ok, fail, readJson } from '@/lib/api';
import { logAudit, clientIp } from '@/lib/audit';
import { throttle, lockoutMessage } from '@/lib/loginGuard';
import { secretBytes, verifyCode, generateBackupCodes, hashBackupCode, formatBackupCode } from '@/lib/totp';

export const dynamic = 'force-dynamic';

/* Finish enrolment. The admin types the code their app is showing; only if it
 * matches does 2FA actually switch on.
 *
 * This step is what makes enrolment safe to require. A wrong QR scan, a phone
 * with a badly wrong clock, an app that silently failed to save — all of them
 * fail here, while the admin is still signed in and can simply try again.
 */
export async function POST(req) {
  const { admin: claims, res } = requireAdmin(req);
  if (res) return res;

  const { code } = await readJson(req);
  const ip = clientIp(req);

  const gate = await throttle('admin_2fa_confirm', ip, { max: 15, windowMinutes: 15, lockMinutes: 15 });
  if (gate.blocked) return fail('RATE_LIMITED', 429, { message: lockoutMessage(gate.retryAfter) });

  const sb = supabaseAdmin();
  const { data: admin } = await sb.from('admin_users')
    .select('id, username, totp_secret_enc, totp_enabled').eq('id', claims.sub).maybeSingle();

  if (!admin) return fail('NOT_FOUND', 404, { message: 'Account not found.' });
  if (admin.totp_enabled) return fail('ALREADY_ENABLED', 409, {
    message: 'Two-factor authentication is already active.' });

  const secret = secretBytes(admin.totp_secret_enc);
  if (!secret) return fail('NO_SETUP', 400, {
    message: 'Start setup again — no pending enrolment was found for this account.' });

  const step = verifyCode(secret, code);
  if (!step) {
    return fail('BAD_CODE', 400, {
      message: 'That code did not match. Check your phone\'s clock is set automatically, then try the current code.',
    });
  }

  /* Backup codes are generated here, at the one moment they can be shown.
   * Only hashes are stored, so this response is the sole opportunity the admin
   * has to record them — the UI is emphatic about that, and there is no
   * endpoint to retrieve them later, by design. */
  const plain = generateBackupCodes(10);

  const { error } = await sb.from('admin_users').update({
    totp_enabled: true,
    totp_confirmed_at: new Date().toISOString(),
    totp_last_step: step,                       // the confirming code is spent
    backup_codes: plain.map(hashBackupCode),
  }).eq('id', admin.id);

  if (error) {
    console.error('[2fa confirm] save failed:', error.message);
    return fail('SAVE_FAILED', 500, { message: 'Could not enable two-factor authentication.' });
  }

  await logAudit({ action: 'ADMIN_2FA_ENABLED', actor: admin.username, ip });

  return ok({
    enabled: true,
    backupCodes: plain.map(formatBackupCode),
    /* The session token in the browser was signed before this moment, so it
     * still carries tfa:false and super admin routes will keep refusing it.
     * Rather than leave someone clicking a dashboard that has quietly stopped
     * working, the wizard signs them out and they come straight back through
     * the new second factor — which also proves, immediately, that enrolment
     * actually works. */
    reauthRequired: true,
  });
}
