import { getAdmin } from '@/lib/auth';
import { fail } from '@/lib/api';
import { requirementFor, satisfies, ANY, SUPER } from '@/lib/adminScopes';

/** Path of the request being served, however the runtime hands it to us. */
function pathOf(req) {
  try { return req?.nextUrl?.pathname || new URL(req.url).pathname; }
  catch { return ''; }
}

/* Permission-area check, applied to EVERY admin route from one place.
 *
 * requireAdmin is already called by all 75 admin routes, so putting the check
 * here covers them without editing each one — and, more importantly, covers
 * any route added later by default. The alternative, a per-route call, is only
 * as good as the memory of whoever adds the next route, and a route that
 * forgets it is not broken in any visible way. It just quietly has no
 * permissions at all.
 *
 * An unmapped path is REFUSED. A new admin route will therefore fail the first
 * time it is opened, with a message naming the fix, rather than shipping with
 * no restriction on it.
 */
function scopeCheck(req, admin) {
  const path = pathOf(req);
  const need = requirementFor(path);

  if (need === null) {
    return fail('SCOPE_UNMAPPED', 403, {
      message: 'This admin route has no permission area assigned. ' +
        'Add it to ROUTE_SCOPES in lib/adminScopes.js.',
    });
  }
  if (satisfies(admin, need)) return null;

  if (need === SUPER) {
    return fail('FORBIDDEN', 403, {
      message: 'You do not have permission to access this resource.',
    });
  }
  return fail('SCOPE_FORBIDDEN', 403, {
    message: 'Your admin account does not have access to this area. ' +
      'A Super Admin can grant it under Admin Accounts.',
  });
}

export function requireAdmin(req) {
  const admin = getAdmin(req);
  if (!admin) return { admin: null, res: fail('UNAUTHORIZED', 401, { message: 'Admin authentication required.' }) };
  const denied = scopeCheck(req, admin);
  if (denied) return { admin, res: denied };
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

/** Areas this token holds. Super admins hold every area implicitly. */
export function scopesOf(admin) {
  if (isSuperAdmin(admin)) return 'ALL';
  return Array.isArray(admin?.scopes) ? admin.scopes : [];
}

/** Convenience for routes that serve several areas from one endpoint. */
export function hasScope(admin, scope) {
  if (isSuperAdmin(admin)) return true;
  return Array.isArray(admin?.scopes) && admin.scopes.includes(scope);
}

export { ANY, SUPER };
