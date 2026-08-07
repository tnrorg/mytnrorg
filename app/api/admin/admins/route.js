import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireSuperAdmin } from '@/lib/guard';
import { hashPassword } from '@/lib/auth';
import { logAudit, clientIp } from '@/lib/audit';
import { ok, fail, readJson } from '@/lib/api';

export const dynamic = 'force-dynamic';

const norm = (r) => (r === 'super_admin' || r === 'superadmin') ? 'super_admin' : 'admin';

// List admin accounts (never returns password hashes)
export async function GET(req) {
  const { res } = requireSuperAdmin(req); if (res) return res;
  const { data } = await supabaseAdmin().from('admin_users')
    .select('id, username, full_name, role, created_at').order('created_at');
  return ok({ admins: (data || []).map(a => ({ ...a, role: norm(a.role) })) });
}

// Create a new admin or super admin
export async function POST(req) {
  const { admin, res } = requireSuperAdmin(req); if (res) return res;
  const b = await readJson(req);
  const username = String(b.username || '').trim().toLowerCase();
  const password = String(b.password || '');
  const role = norm(b.role);

  if (username.length < 3) return fail('INVALID', 400, { message: 'Username must be at least 3 characters.' });
  if (password.length < 8) return fail('WEAK_PASSWORD', 400, { message: 'Password must be at least 8 characters.' });

  const sb = supabaseAdmin();
  const { data: exists } = await sb.from('admin_users').select('id').eq('username', username).maybeSingle();
  if (exists) return fail('DUPLICATE', 409, { message: 'That username is already taken.' });

  const { data, error } = await sb.from('admin_users')
    .insert({ username, password_hash: await hashPassword(password), full_name: String(b.full_name || '').trim() || null, role })
    .select('id, username, full_name, role, created_at').single();
  if (error) return fail('CREATE_FAILED', 500, { message: 'Could not create the admin.', detail: error.message });

  await logAudit({ action: 'ADMIN_CREATED', actor: admin?.username || 'super_admin', details: `${username} (${role})`, ip: clientIp(req) });
  return ok({ admin: data });
}
