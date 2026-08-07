import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAdmin } from '@/lib/guard';
import { ok, fail } from '@/lib/api';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export async function GET(req) {
  const { res } = requireAdmin(req); if (res) return res;
  const url = new URL(req.url);
  const status = url.searchParams.get('status') || '';
  const search = (url.searchParams.get('search') || '').trim();

  let q = supabaseAdmin().from('membership_applications').select('*')
    .order('created_at', { ascending: false }).limit(500);
  if (status) q = q.eq('status', status);
  if (search) q = q.or(
    `full_name.ilike.%${search}%,email.ilike.%${search}%,mobile.ilike.%${search}%,reference_no.ilike.%${search}%`
  );
  // The error was previously discarded, so a failed query rendered as "no
  // applications" — indistinguishable from an empty queue. Surface it instead.
  const { data, error } = await q;
  if (error) return fail('READ_FAILED', 500, {
    message: 'Could not load applications: ' + error.message,
    hint: 'If this mentions a missing column, run the pending migrations in supabase/.',
  });
  return ok({ applications: data || [], total: (data || []).length });
}
