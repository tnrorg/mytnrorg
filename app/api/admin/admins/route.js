import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireSuperAdmin } from '@/lib/guard';
import { hashPassword } from '@/lib/auth';
import { logAudit, clientIp } from '@/lib/audit';
import { ok, fail, readJson } from '@/lib/api';
import { cleanScopes, ALL_SCOPES, SCOPES, scopeLabel } from '@/lib/adminScopes';

export const dynamic = 'force-dynamic';

const norm = (r) => (r === 'super_admin' || r === 'superadmin') ? 'super_admin' : 'admin';

// List admin accounts (never returns password hashes)
export async function GET(req) {
  const { res } = await requireSuperAdmin(req); if (res) return res;
  const sb = supabaseAdmin();

  /* Fall back to a select without `scopes` if the migration has not been run.
   * Postgres refuses the whole query for one unknown column, so without this
   * the Admin Accounts screen would show "no admins" — which reads as data
   * loss, not as a pending migration. */
  const BASE = 'id, username, full_name, role, created_at';
  let { data, error } = await sb.from('admin_users')
    .select(`${BASE}, scopes`).order('created_at');
  let migrated = !error;
  if (error) ({ data } = await sb.from('admin_users').select(BASE).order('created_at'));

  return ok({
    // Sent so the checkbox list and its labels live in one place on the server.
    scope_options: SCOPES,
    migration_pending: !migrated,
    admins: (data || []).map(a => {
      const role = norm(a.role);
      return {
        ...a, role,
        // Super admins hold every area by rank, not by what is stored.
        scopes: role === 'super_admin' ? ALL_SCOPES
          : (migrated ? cleanScopes(a.scopes) : ALL_SCOPES),
      };
    }),
  });
}

// Create a new admin or super admin
export async function POST(req) {
  const { admin, res } = await requireSuperAdmin(req); if (res) return res;
  const b = await readJson(req);
  const username = String(b.username || '').trim().toLowerCase();
  const password = String(b.password || '');
  const role = norm(b.role);

  if (username.length < 3) return fail('INVALID', 400, { message: 'Username must be at least 3 characters.' });
  if (password.length < 8) return fail('WEAK_PASSWORD', 400, { message: 'Password must be at least 8 characters.' });

  /* Areas the new account may reach.
   *
   * A super admin gets all six regardless of what was ticked — the checkboxes
   * are disabled for that role in the UI, and this makes the same true of a
   * request that skips the UI.
   *
   * A normal admin with nothing ticked is rejected rather than created. An
   * account that can sign in and reach nothing looks broken to the person
   * holding it, and they will report it as a bug rather than as a permission
   * they were never given. */
  const scopes = role === 'super_admin' ? ALL_SCOPES : cleanScopes(b.scopes);
  if (role !== 'super_admin' && !scopes.length)
    return fail('NO_SCOPES', 400, { message: 'Choose at least one area this admin can work in.' });

  const sb = supabaseAdmin();
  const { data: exists } = await sb.from('admin_users').select('id').eq('username', username).maybeSingle();
  if (exists) return fail('DUPLICATE', 409, { message: 'That username is already taken.' });

  const { data, error } = await sb.from('admin_users')
    .insert({ username, password_hash: await hashPassword(password), full_name: String(b.full_name || '').trim() || null, role, scopes })
    .select('id, username, full_name, role, scopes, created_at').single();
  if (error) return fail('CREATE_FAILED', 500, {
    message: error.message?.includes('scopes')
      ? 'Run migration_admin_scopes.sql in Supabase first — the permissions column is missing.'
      : 'Could not create the admin.',
    detail: error.message,
  });

  await logAudit({
    action: 'ADMIN_CREATED', actor: admin?.username || 'super_admin',
    details: `${username} (${role})${role === 'super_admin' ? '' : ` — ${scopes.map(scopeLabel).join('/')}`}`,
    ip: clientIp(req),
  });
  return ok({ admin: data });
}
