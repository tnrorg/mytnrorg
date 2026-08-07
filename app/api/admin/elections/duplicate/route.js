import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAdmin } from '@/lib/guard';
import { logAudit, clientIp } from '@/lib/audit';
import { ok, fail, readJson } from '@/lib/api';
export const dynamic = 'force-dynamic';

// Duplicate an election with its positions, candidates and result settings — but NOT votes/voter-list.
export async function POST(req) {
  const { admin, res } = requireAdmin(req); if (res) return res;
  const sb = supabaseAdmin();
  const { election_id } = await readJson(req);
  if (!election_id) return fail('MISSING', 400, { message: 'election_id required.' });
  const { data: src } = await sb.from('elections').select('*').eq('id', election_id).maybeSingle();
  if (!src) return fail('NOT_FOUND', 404, { message: 'Election not found.' });

  const { data: ne, error } = await sb.from('elections').insert({
    title: src.title + ' (Copy)', description: src.description,
    starts_at: src.starts_at, ends_at: src.ends_at, status: 'Draft',
  }).select().maybeSingle();
  if (error) return fail('COPY_FAILED', 500, { message: error.message });

  const { data: positions } = await sb.from('positions').select('*').eq('election_id', election_id).order('sort_order');
  const posMap = {};
  for (const p of positions || []) {
    const { data: np } = await sb.from('positions').insert({ election_id: ne.id, title: p.title, sort_order: p.sort_order }).select().maybeSingle();
    posMap[p.id] = np?.id || null;
  }
  const { data: cands } = await sb.from('candidates').select('*').eq('election_id', election_id).order('sort_order');
  for (const c of cands || []) {
    await sb.from('candidates').insert({
      election_id: ne.id, position_id: posMap[c.position_id] || null, name: c.name, photo_url: c.photo_url,
      symbol: c.symbol, symbol_url: c.symbol_url, union_id: c.union_id, manifesto: c.manifesto,
      education: c.education, status: c.status, sort_order: c.sort_order,
    });
  }
  await sb.from('result_settings').insert({ election_id: ne.id });
  await logAudit({ action: 'ELECTION_DUPLICATED', actor: admin.username, details: `${src.title} → copy`, election_id: ne.id, ip: clientIp(req) });
  return ok({ election: ne });
}
