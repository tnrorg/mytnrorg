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
  return { admin, res: null };
}
export function isSuperAdmin(admin) { return admin?.role === 'super_admin' || admin?.role === 'superadmin'; }
