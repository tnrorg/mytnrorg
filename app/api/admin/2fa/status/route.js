import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAdmin } from '@/lib/guard';
import { ok, fail, readJson } from '@/lib/api';
import { logAudit, clientIp } from '@/lib/audit';
import { mustEnrol } from '@/lib/admin2fa';

export const dynamic = 'force-dynamic';

/* What the Security tab reads on open. Reports state only — never the secret,
 * never a backup code, not even a hash of one. */
export async function GET(req) {
  const { admin: claims, res } = requireAdmin(req);
  if (res) return res;

  const { data: admin, error } = await supabaseAdmin().from('admin_users')
    .select('username, role, email, totp_enabled, totp_confirmed_at, backup_codes')
    .eq('id', claims.sub).maybeSingle();

  if (error) {
    // The columns are missing until the migration runs. Reporting that plainly
    // beats a blank tab with no explanation.
    return ok({
      available: false,
      message: 'Two-factor authentication is not set up on this database yet. ' +
        'Run supabase/migration_admin_2fa.sql.',
    });
  }
  if (!admin) return fail('NOT_FOUND', 404, { message: 'Account not found.' });

  return ok({
    available: true,
    enabled: !!admin.totp_enabled,
    confirmedAt: admin.totp_confirmed_at,
    backupCodesLeft: Array.isArray(admin.backup_codes) ? admin.backup_codes.length : 0,
    recoveryEmail: admin.email ? maskEmail(admin.email) : null,
    hasRecoveryEmail: !!admin.email,
    required: mustEnrol(admin) || !!admin.totp_enabled,
    enrolRequired: mustEnrol(admin),
  });
}

/* Set the recovery email for the emailed-code fallback.
 *
 * Self-service on purpose: an admin locked out with no recovery address has to
 * be rescued through the database, and that is a worse outcome than letting
 * them set their own. It is audited, and changing it does not weaken the app
 * factor — an emailed code is only ever accepted after the password.
 */
export async function POST(req) {
  const { admin: claims, res } = requireAdmin(req);
  if (res) return res;

  const { email } = await readJson(req);
  const clean = String(email || '').trim().toLowerCase();

  if (clean && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(clean))
    return fail('INVALID', 400, { message: 'Enter a valid email address.' });

  const { error } = await supabaseAdmin().from('admin_users')
    .update({ email: clean || null }).eq('id', claims.sub);

  if (error) return fail('SAVE_FAILED', 500, { message: 'Could not save the recovery email.' });

  await logAudit({
    action: 'ADMIN_2FA_RECOVERY_EMAIL_SET',
    actor: claims.username,
    ip: clientIp(req),
    details: clean ? maskEmail(clean) : 'cleared',
  });

  return ok({ saved: true, recoveryEmail: clean ? maskEmail(clean) : null, hasRecoveryEmail: !!clean });
}

function maskEmail(email) {
  const [user, domain] = String(email).split('@');
  if (!domain) return null;
  return `${user.slice(0, 1)}${'*'.repeat(Math.max(3, user.length - 1))}@${domain}`;
}
