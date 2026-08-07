import { supabaseAdmin } from '@/lib/supabaseServer';
import { verifyPassword, signAdmin } from '@/lib/auth';
import { logAudit, clientIp } from '@/lib/audit';
import { ok, fail, readJson } from '@/lib/api';
export const dynamic = 'force-dynamic';
export async function POST(req) {
  const { username, password } = await readJson(req);
  if (!username || !password) return fail('MISSING', 400, { message: 'Username and password required.' });
  const sb = supabaseAdmin();
  const { data: admin } = await sb.from('admin_users').select('*').eq('username', username).maybeSingle();
  if (!admin || !(await verifyPassword(password, admin.password_hash)))
    return fail('BAD_CREDENTIALS', 401, { message: 'Invalid username or password.' });
  const token = signAdmin(admin);
  await logAudit({ action: 'ADMIN_LOGIN', actor: admin.username, ip: clientIp(req) });
  // The role stays out of the response body — the client asks /api/admin/me instead.
  return ok({ token, admin: { id: admin.id, username: admin.username, full_name: admin.full_name } });
}
