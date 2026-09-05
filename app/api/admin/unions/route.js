import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAdmin } from '@/lib/guard';
import { ok, fail, readJson } from '@/lib/api';
export const dynamic = 'force-dynamic';
export async function GET(req) {
  const { res } = await requireAdmin(req); if (res) return res;
  const { data } = await supabaseAdmin().from('unions').select('*').order('id');
  return ok({ unions: data || [] });
}
export async function POST(req) {
  const { res } = await requireAdmin(req); if (res) return res;
  const b = await readJson(req);
  if (!b.union_name) return fail('MISSING', 400, { message: 'Union name required.' });
  const { data, error } = await supabaseAdmin().from('unions').insert({ union_name: b.union_name, union_code: b.union_code || null }).select().maybeSingle();
  if (error) return fail('INSERT_FAILED', 500, { message: error.message });
  return ok({ union: data });
}
