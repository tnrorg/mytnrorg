import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAdmin } from '@/lib/guard';
import { logAudit, clientIp } from '@/lib/audit';
import { ok, fail, readJson } from '@/lib/api';
export const dynamic = 'force-dynamic';

export async function GET(req) {
  const { res } = requireAdmin(req); if (res) return res;
  const sb = supabaseAdmin();
  const { data: elections } = await sb.from('elections').select('*').order('created_at', { ascending: false });
  const { data: positions } = await sb.from('positions').select('*').order('sort_order');
  const { data: settings } = await sb.from('result_settings').select('*');
  const { data: cands } = await sb.from('candidates').select('election_id, position_id, status');
  const counts = {};
  for (const c of cands || []) {
    counts[c.election_id] = counts[c.election_id] || { total: 0, active: 0, no_position: 0 };
    counts[c.election_id].total++;
    if (c.status === 'Active') counts[c.election_id].active++;
    if (!c.position_id) counts[c.election_id].no_position++;
  }
  const withCounts = (elections || []).map(e => ({ ...e, candidate_count: counts[e.id] || { total: 0, active: 0, no_position: 0 } }));
  return ok({ elections: withCounts, positions: positions || [], settings: settings || [] });
}

export async function POST(req) {
  const { admin, res } = requireAdmin(req); if (res) return res;
  const sb = supabaseAdmin();
  const b = await readJson(req);
  if (!b.title) return fail('MISSING', 400, { message: 'Election title is required.' });
  const { data: e, error } = await sb.from('elections').insert({
    title: b.title, description: b.description || null,
    starts_at: b.starts_at || null, ends_at: b.ends_at || null, status: 'Draft',
  }).select().maybeSingle();
  if (error) return fail('INSERT_FAILED', 500, { message: error.message });

  const positions = (b.positions && b.positions.length) ? b.positions
    : ['President','Vice President','General Secretary','Finance Secretary','Committee Member'];
  await sb.from('positions').insert(positions.map((title, i) => ({ election_id: e.id, title, sort_order: i })));
  await sb.from('result_settings').insert({ election_id: e.id });
  await logAudit({ action: 'ELECTION_CREATED', actor: admin.username, details: b.title, election_id: e.id, ip: clientIp(req) });
  return ok({ election: e });
}
