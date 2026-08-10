import { getAdmin } from '@/lib/auth';
import { fail } from '@/lib/api';
export function requireAdmin(req) {
  const admin = getAdmin(req);
  if (!admin) return { admin: null, res: fail('UNAUTHORIZED', 401, { message: 'Admin authentication required.' }) };
  return { admin, res: null };
}

export function requireSuperAdmin(req) {
  const admin = getAdmin(req);
  if (!admin) return { admin: null, res: fail('UNAUTHORIZED', 401, { message: 'Admin authentication required.' }) };
  const role = admin.role;
  if (role !== 'super_admin' && role !== 'superadmin')
    return { admin, res: fail('FORBIDDEN', 403, { message: 'You do not have permission to access this resource.' }) };

  /* Super admin powers require a second factor, enforced here rather than only
   * in the UI.
   *
   * These are the routes that read every member record, edit roles and manage
   * other admin accounts. A password alone should not reach them. The client
   * shows an enrolment wizard for the same condition, but that is a courtesy —
   * this is the control, and it applies to a hand-crafted request just as much
   * as to the panel.
   *
   * 428 rather than 403: the caller is who they claim to be, they have simply
   * not satisfied a precondition yet. The message says how to fix it, because
   * an admin locked out with "forbidden" and no explanation files a bug. */
  if (admin.tfa !== true)
    return { admin, res: fail('TWO_FACTOR_REQUIRED', 428, {
      message: 'Super admin actions require two-factor authentication. ' +
        'Open My Security to set it up, then sign in again.',
      enrolRequired: true,
    }) };

  return { admin, res: null };
}
export function isSuperAdmin(admin) { return admin?.role === 'super_admin' || admin?.role === 'superadmin'; }
