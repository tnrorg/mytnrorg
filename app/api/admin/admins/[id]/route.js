import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireSuperAdmin } from '@/lib/guard';
import { hashPassword } from '@/lib/auth';
import { logAudit, clientIp } from '@/lib/audit';
import { ok, fail, readJson } from '@/lib/api';
import { cleanScopes, ALL_SCOPES, scopeLabel } from '@/lib/adminScopes';

export const dynamic = 'force-dynamic';
const norm = (r) => (r === 'super_admin' || r === 'superadmin') ? 'super_admin' : 'admin';

// Update name / role / password
export async function PATCH(req, props) {
  const params = await props.params;
  const { admin, res } = requireSuperAdmin(req);if (res) return res;
  const id = params.id;
  const b = await readJson(req);
  const sb = supabaseAdmin();

  const { data: target } = await sb.from('admin_users').select('id, username, role').eq('id', id).maybeSingle();
  if (!target) return fail('NOT_FOUND', 404, { message: 'Admin not found.' });

  const patch = {};
  if (b.full_name !== undefined) patch.full_name = String(b.full_name || '').trim() || null;
  if (b.role !== undefined) patch.role = norm(b.role);
  if (b.password) {
    if (String(b.password).length < 8) return fail('WEAK_PASSWORD', 400, { message: 'Password must be at least 8 characters.' });
    patch.password_hash = await hashPassword(String(b.password));
  }

  /* Permission areas.
   *
   * cleanScopes drops anything that is not one of the six, so a crafted
   * request cannot invent an area — and since rank lives in `role`, which is
   * handled separately above, no value sent here can grant super admin.
   *
   * A super admin's row is stored with every area. Their access does not come
   * from this column, but keeping it complete means demoting someone to
   * normal admin leaves them working rather than silently locked out. */
  const wantsScopes = b.scopes !== undefined;
  if (wantsScopes) {
    const scopes = cleanScopes(b.scopes);
    if (!scopes.length && norm(patch.role ?? target.role) !== 'super_admin')
      return fail('NO_SCOPES', 400, {
        message: 'Give this admin at least one area, or delete the account.',
      });
    patch.scopes = scopes;
  }
  if (patch.role === 'super_admin') patch.scopes = ALL_SCOPES;

  // Never allow the last super admin to be demoted — it would lock everyone out.
  if (patch.role === 'admin' && norm(target.role) === 'super_admin') {
    const { data: supers } = await sb.from('admin_users').select('id, role');
    const count = (supers || []).filter(a => norm(a.role) === 'super_admin').length;
    if (count <= 1) return fail('LAST_SUPER_ADMIN', 400, { message: 'This is the only Super Admin. Promote another account first.' });
  }

  const { error } = await sb.from('admin_users').update(patch).eq('id', id);
  if (error) return fail('UPDATE_FAILED', 500, { message: 'Could not update the admin.', detail: error.message });

  const what = [
    b.password ? 'password' : null,
    b.role !== undefined ? `role→${patch.role}` : null,
    // Named in full in the audit log. "areas changed" tells whoever reads it
    // later nothing about what someone could reach at the time.
    wantsScopes ? `areas→${(patch.scopes || []).map(scopeLabel).join('/') || 'none'}` : null,
  ].filter(Boolean).join(', ');
  await logAudit({ action: 'ADMIN_UPDATED', actor: admin?.username || 'super_admin', details: `${target.username} ${what}`.trim(), ip: clientIp(req) });
  return ok({ updated: true });
}

export async function DELETE(req, props) {
  const params = await props.params;
  const { admin, res } = requireSuperAdmin(req);if (res) return res;
  const sb = supabaseAdmin();
  const { data: target } = await sb.from('admin_users').select('id, username, role').eq('id', params.id).maybeSingle();
  if (!target) return fail('NOT_FOUND', 404, { message: 'Admin not found.' });
  if (admin?.sub === target.id) return fail('SELF_DELETE', 400, { message: 'You cannot delete your own account.' });

  if (norm(target.role) === 'super_admin') {
    const { data: supers } = await sb.from('admin_users').select('id, role');
    if ((supers || []).filter(a => norm(a.role) === 'super_admin').length <= 1)
      return fail('LAST_SUPER_ADMIN', 400, { message: 'You cannot delete the only Super Admin.' });
  }

  const { error } = await sb.from('admin_users').delete().eq('id', params.id);
  if (error) return fail('DELETE_FAILED', 500, { message: 'Could not delete the admin.', detail: error.message });
  await logAudit({ action: 'ADMIN_DELETED', actor: admin?.username || 'super_admin', details: target.username, ip: clientIp(req) });
  return ok({ deleted: true });
}
