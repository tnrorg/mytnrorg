import { supabaseAdmin } from '@/lib/supabaseServer';
import { getActiveElection, getSettings, isVotingOpen } from '@/lib/election';
import { ok } from '@/lib/api';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

async function count(sb, table, filter) {
  let q = sb.from(table).select('*', { count: 'exact', head: true });
  for (const [k, v] of Object.entries(filter || {})) q = q.eq(k, v);
  const { count } = await q; return count || 0;
}
export async function GET() {
  const sb = supabaseAdmin();
  const e = await getActiveElection();
  if (!e) return ok({ election: null });
  const total_voters = await count(sb, 'members', { status: 'Approved' });
  // Votes Cast = unique voters who completed a ballot (one ballot = one row per
  // position, so counting rows would multiply by the number of positions).
  const { data: voteRows } = await sb.from('votes').select('member_id').eq('election_id', e.id);
  const votes_cast = new Set((voteRows || []).map(v => v.member_id)).size;
  const settings = await getSettings(e.id);
  const votingOpen = isVotingOpen(e);
  const resultsVisible = e.result_published || (e.status === 'Ended') || (!votingOpen && settings.show_full_after_end);
  return ok({
    election: { id: e.id, title: e.title, status: e.status, voting_open: votingOpen, result_published: e.result_published },
    total_voters, votes_cast,
    remaining: Math.max(0, total_voters - votes_cast),
    participation: total_voters ? Math.round((votes_cast / total_voters) * 1000) / 10 : 0,
    results_visible: resultsVisible,
    fairness_note: !resultsVisible,
  });
}
