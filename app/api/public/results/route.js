import { supabaseAdmin } from '@/lib/supabaseServer';
import { getActiveElection, getSettings, isVotingOpen } from '@/lib/election';
import { ok, fail } from '@/lib/api';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export async function GET() {
  const sb = supabaseAdmin();
  const e = await getActiveElection();
  if (!e) return ok({ election: null });

  const settings = await getSettings(e.id);
  const votingOpen = isVotingOpen(e);
  // Show live results when the admin picks a live mode (full/percent/leading), or when published/ended.
  const liveMode = ['full', 'percent', 'leading'].includes(settings.result_mode);
  const allowed = liveMode || e.result_published || (!votingOpen && settings.show_full_after_end) || e.status === 'Ended';
  if (!allowed) {
    return ok({ election: { id: e.id, title: e.title, status: e.status }, results_visible: false,
      message: 'Candidate results are hidden during voting for fairness. Only participation is shown live.' });
  }

  const { data: positions } = await sb.from('positions').select('*').eq('election_id', e.id).order('sort_order');
  const { data: candidates } = await sb.from('candidates').select('*').eq('election_id', e.id).order('sort_order');
  const { data: votes } = await sb.from('votes').select('candidate_id, position_id, member_id').eq('election_id', e.id);
  const { data: unions } = await sb.from('unions').select('id, union_name');
  const umap = Object.fromEntries((unions || []).map(u => [u.id, u.union_name]));

  const tally = {};
  for (const v of votes || []) tally[v.candidate_id] = (tally[v.candidate_id] || 0) + 1;
  // Votes Cast = unique voters who completed a ballot, NOT total candidate selections.
  // One ballot has one row per position, so counting rows would multiply by the number of positions.
  const votesCast = new Set((votes || []).map(v => v.member_id)).size;

  // group by position, compute winner
  const byPosition = (positions || []).map(p => {
    const cands = (candidates || []).filter(c => c.position_id === p.id).map(c => ({
      id: c.id, name: c.name, photo_url: c.photo_url, symbol: c.symbol,
      union_name: umap[c.union_id] || null, votes: tally[c.id] || 0,
    }));
    const posTotal = cands.reduce((s, c) => s + c.votes, 0);
    cands.forEach(c => c.percent = posTotal ? Math.round((c.votes / posTotal) * 1000) / 10 : 0);
    cands.sort((a, b) => b.votes - a.votes);
    const winner = cands.length && cands[0].votes > 0 ? cands[0].id : null;
    return { position: p.title, position_id: p.id, total: posTotal, winner, candidates: cands };
  });

  // union-wise vote share
  const { data: votesFull } = await sb.from('votes').select('candidate_id').eq('election_id', e.id);
  const candUnion = Object.fromEntries((candidates || []).map(c => [c.id, c.union_id]));
  const unionTally = {};
  for (const v of votesFull || []) { const u = candUnion[v.candidate_id]; if (u) unionTally[u] = (unionTally[u] || 0) + 1; }
  const unionShare = Object.entries(unionTally).map(([uid, n]) => ({ union: umap[uid] || 'Unknown', votes: n }))
    .sort((a, b) => b.votes - a.votes);

  const total_voters = (await sb.from('members').select('*', { count: 'exact', head: true }).eq('status', 'Approved')).count || 0;

  return ok({
    election: { id: e.id, title: e.title, status: e.status, result_published: e.result_published },
    results_visible: true, total_votes: votesCast, total_voters,
    participation: total_voters ? Math.round((votesCast / total_voters) * 1000) / 10 : 0,
    positions: byPosition, union_share: unionShare,
  });
}
