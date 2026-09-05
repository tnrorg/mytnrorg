import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAdmin } from '@/lib/guard';
import { ok, fail } from '@/lib/api';
import { ACTIVE_STATUSES } from '@/lib/membershipStats';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export async function GET(req) {
  const { res } = await requireAdmin(req); if (res) return res;
  const url = new URL(req.url);
  const status = url.searchParams.get('status') || '';
  const search = (url.searchParams.get('search') || '').trim();

  let q = supabaseAdmin().from('membership_members').select('*')
    .is('deleted_at', null).order('created_at', { ascending: false }).limit(1000);
  // "Active" must cover BOTH `active` and `approved`. They are equivalent
  // everywhere else (public directory, analytics, login), so filtering on the
  // literal string alone made approved members visible under All and nowhere
  // else — the count mismatch this fixes.
  if (status === 'active') q = q.in('status', ACTIVE_STATUSES);
  else if (status) q = q.eq('status', status);
  if (search) q = q.or(
    `full_name.ilike.%${search}%,email.ilike.%${search}%,membership_id.ilike.%${search}%,village.ilike.%${search}%`
  );
  const { data, error } = await q;
  // Surface the failure rather than returning an empty list, which reads as
  // "nothing here" and hides the real problem.
  if (error) return fail('READ_FAILED', 500, { message: error.message });
  const members = (data || []).map(({ password_hash, invite_token, ...m }) => m);
  return ok({ members });
}
