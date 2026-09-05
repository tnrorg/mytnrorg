import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAdmin } from '@/lib/guard';
import { getActiveElection, getSettings } from '@/lib/election';
import { ok } from '@/lib/api';
export const dynamic = 'force-dynamic';
export async function GET(req) {
  const { res } = await requireAdmin(req); if (res) return res;
  const sb = supabaseAdmin();
  const url = new URL(req.url);
  let election_id = url.searchParams.get('election_id');
  if (!election_id) { const e = await getActiveElection(); election_id = e?.id; }
  if (!election_id) return ok({ positions: [], union_share: [] });

  const settings = await getSettings(election_id);
  if (!settings.admin_live_preview) return ok({ preview_disabled: true });

  const { data: positions } = await sb.from('positions').select('*').eq('election_id', election_id).order('sort_order');
  const { data: candidates } = await sb.from('candidates').select('*').eq('election_id', election_id).order('sort_order');
  const { data: votes } = await sb.from('votes').select('candidate_id').eq('election_id', election_id);
  const { data: unions } = await sb.from('unions').select('id, union_name');
  const umap = Object.fromEntries((unions || []).map(u => [u.id, u.union_name]));
  const tally = {}; for (const v of votes || []) tally[v.candidate_id] = (tally[v.candidate_id] || 0) + 1;

  const byPosition = (positions || []).map(p => {
    const cands = (candidates || []).filter(c => c.position_id === p.id).map(c => ({
      id: c.id, name: c.name, photo_url: c.photo_url, symbol: c.symbol,
      union_name: umap[c.union_id] || null, votes: tally[c.id] || 0,
    }));
    const t = cands.reduce((s, c) => s + c.votes, 0);
    cands.forEach(c => c.percent = t ? Math.round((c.votes / t) * 1000) / 10 : 0);
    cands.sort((a, b) => b.votes - a.votes);
    return { position: p.title, position_id: p.id, total: t, winner: cands[0]?.votes ? cands[0].id : null, candidates: cands };
  });
  const candUnion = Object.fromEntries((candidates || []).map(c => [c.id, c.union_id]));
  const unionTally = {}; for (const v of votes || []) { const u = candUnion[v.candidate_id]; if (u) unionTally[u] = (unionTally[u] || 0) + 1; }
  const union_share = Object.entries(unionTally).map(([uid, n]) => ({ union: umap[uid] || 'Unknown', votes: n })).sort((a,b)=>b.votes-a.votes);
  return ok({ positions: byPosition, union_share, total_votes: (votes || []).length });
}
