import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAdmin } from '@/lib/guard';
import { verifyPassword } from '@/lib/auth';
import { ok, fail, readJson } from '@/lib/api';
import { logAudit, clientIp } from '@/lib/audit';
import { throttle, lockoutMessage } from '@/lib/loginGuard';
import { mustEnrol } from '@/lib/admin2fa';

export const dynamic = 'force-dynamic';

/* Turn 2FA off, or clear it to enrol a new phone.
 *
 * The current password is required. Without that, a stolen session token —
 * exactly the thing 2FA exists to survive — could be used to remove 2FA and
 * then keep the account. A control that can be switched off by the attack it
 * defends against is decoration.
 */
export async function POST(req) {
  const { admin: claims, res } = await requireAdmin(req);
  if (res) return res;

  const { password } = await readJson(req);
  const ip = clientIp(req);

  if (!password) return fail('INVALID', 400, {
    message: 'Enter your password to turn off two-factor authentication.' });

  const gate = await throttle('admin_2fa_disable', ip, { max: 10, windowMinutes: 15, lockMinutes: 30 });
  if (gate.blocked) return fail('RATE_LIMITED', 429, { message: lockoutMessage(gate.retryAfter) });

  const sb = supabaseAdmin();
  const { data: admin } = await sb.from('admin_users')
    .select('*').eq('id', claims.sub).maybeSingle();
  if (!admin) return fail('NOT_FOUND', 404, { message: 'Account not found.' });

  if (!(await verifyPassword(password, admin.password_hash))) {
    await logAudit({ action: 'ADMIN_2FA_DISABLE_FAILED', actor: admin.username, ip });
    return fail('BAD_PASSWORD', 401, { message: 'Incorrect password.' });
  }

  const { error } = await sb.from('admin_users').update({
    totp_enabled: false,
    totp_secret_enc: null,
    totp_confirmed_at: null,
    totp_last_step: 0,
    // Cleared with the secret. Backup codes that outlived their enrolment
    // would be a set of standing passwords for an account that believes it has
    // no second factor at all.
    backup_codes: [],
  }).eq('id', admin.id);

  if (error) return fail('SAVE_FAILED', 500, { message: 'Could not update two-factor settings.' });

  // Worth an audit entry either way, but especially for a super admin: this is
  // an account stepping back out of a required control.
  await logAudit({
    action: 'ADMIN_2FA_DISABLED',
    actor: admin.username,
    ip,
    details: mustEnrol({ ...admin, totp_enabled: false }) ? 'super-admin: re-enrolment required' : '',
  });

  return ok({ enabled: false, enrolRequired: mustEnrol({ ...admin, totp_enabled: false }) });
}
