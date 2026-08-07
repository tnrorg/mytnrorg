import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAdmin } from '@/lib/guard';
import { logAudit, clientIp } from '@/lib/audit';
import { ok, fail, readJson } from '@/lib/api';
export const dynamic = 'force-dynamic';

export async function POST(req) {
  const { admin, res } = requireAdmin(req); if (res) return res;
  const sb = supabaseAdmin();
  const b = await readJson(req);
  if (!b.election_id || !b.title) return fail('MISSING', 400, { message: 'Election and position title required.' });
  const { data: last } = await sb.from('positions').select('sort_order').eq('election_id', b.election_id).order('sort_order', { ascending: false }).limit(1).maybeSingle();
  const sort_order = (last?.sort_order ?? -1) + 1;
  const { data, error } = await sb.from('positions').insert({ election_id: b.election_id, title: b.title, sort_order }).select().maybeSingle();
  if (error) return fail('INSERT_FAILED', 500, { message: error.message });
  await logAudit({ action: 'POSITION_ADDED', actor: admin.username, details: b.title, election_id: b.election_id, ip: clientIp(req) });
  return ok({ position: data });
}
