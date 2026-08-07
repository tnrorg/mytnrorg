import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAdmin } from '@/lib/guard';
import { uploadDataUrl } from '@/lib/storage';
import { getActiveElection } from '@/lib/election';
import { logAudit, clientIp } from '@/lib/audit';
import { ok, fail, readJson } from '@/lib/api';
export const dynamic = 'force-dynamic';

export async function GET(req) {
  const { res } = requireAdmin(req); if (res) return res;
  const sb = supabaseAdmin();
  const url = new URL(req.url);
  let electionId = url.searchParams.get('election_id');
  if (!electionId) { const e = await getActiveElection(); electionId = e?.id; }
  if (!electionId) return ok({ candidates: [], positions: [] });
  const { data: candidates } = await sb.from('candidates').select('*').eq('election_id', electionId).order('sort_order');
  const { data: positions } = await sb.from('positions').select('*').eq('election_id', electionId).order('sort_order');
  return ok({ candidates: candidates || [], positions: positions || [] });
}

export async function POST(req) {
  const { admin, res } = requireAdmin(req); if (res) return res;
  const sb = supabaseAdmin();
  const b = await readJson(req);
  let election_id = b.election_id;
  if (!election_id) { const e = await getActiveElection(); election_id = e?.id; }
  if (!election_id || !b.name) return fail('MISSING', 400, { message: 'Election and candidate name required.' });
  let photo_url = b.photo_url || null;
  if (b.photo_data) { try { photo_url = await uploadDataUrl(b.photo_data, 'candidates'); } catch (e) { console.error('photo upload failed:', e.message); photo_url = null; } }
  let symbol_url = b.symbol_url || null;
  if (b.symbol_data) { try { symbol_url = await uploadDataUrl(b.symbol_data, 'symbols'); } catch (e) { console.error('symbol upload failed:', e.message); symbol_url = null; } }
  const row = {
    election_id, position_id: b.position_id || null, name: b.name, photo_url,
    symbol: b.symbol || null, symbol_url, union_id: b.union_id || null, manifesto: b.manifesto || null,
    education: b.education || null, status: b.status || 'Active', sort_order: b.sort_order || 0,
  };
  let { data, error } = await sb.from('candidates').insert(row).select().maybeSingle();
  if (error && /symbol_url/.test(error.message)) {
    // DB not migrated yet — save without the symbol image column.
    const { symbol_url: _drop, ...noSym } = row;
    ({ data, error } = await sb.from('candidates').insert(noSym).select().maybeSingle());
  }
  if (error) return fail('INSERT_FAILED', 500, { message: error.message });
  await logAudit({ action: 'CANDIDATE_ADDED', actor: admin.username, details: b.name, election_id, ip: clientIp(req) });
  return ok({ candidate: data });
}
