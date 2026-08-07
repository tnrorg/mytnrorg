import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAdmin, isSuperAdmin } from '@/lib/guard';
import { superAdminActors, filterForNormalAdmin } from '@/lib/auditVisibility';
import { ok, fail } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  const { admin, res } = requireAdmin(req); if (res) return res;
  const sb = supabaseAdmin();
  const url = new URL(req.url);
  const action = url.searchParams.get('action') || '';

  let q = sb.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(500);
  if (action) q = q.eq('action', action);
  const { data, error } = await q;
  // Surface the failure rather than returning an empty list, which reads as
  // "nothing here" and hides the real problem.
  if (error) return fail('READ_FAILED', 500, { message: error.message });

  if (isSuperAdmin(admin)) return ok({ logs: data || [], scope: 'all' });

  // Normal admin: hide Super-Admin-only actions and anything a Super Admin did.
  const actors = await superAdminActors();
  return ok({ logs: filterForNormalAdmin(data, actors), scope: 'limited' });
}
