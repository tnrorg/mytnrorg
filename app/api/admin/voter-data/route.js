import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireSuperAdmin } from '@/lib/guard';
import { getActiveElection } from '@/lib/election';
import { ok, fail } from '@/lib/api';

export const dynamic = 'force-dynamic';

// SUPER ADMIN ONLY — full details of every member who has cast a ballot,
// including the candidate chosen for each position.
export async function GET(req) {
  const { res } = requireSuperAdmin(req); if (res) return res;
  const sb = supabaseAdmin();
  try {
  const url = new URL(req.url);
  let election_id = url.searchParams.get('election_id');
  if (!election_id) { const e = await getActiveElection(); election_id = e?.id; }
  if (!election_id) return ok({ voters: [], total: 0, note: 'No active election found.' });

  const { data: votes, error: votesErr } = await sb.from('votes')
    .select('member_id, position_id, candidate_id, created_at').eq('election_id', election_id);
  if (votesErr) return fail('VOTES_ERR', 500, { message: 'Could not read votes.', detail: votesErr.message });
  const { data: positions } = await sb.from('positions').select('id, title, sort_order')
    .eq('election_id', election_id).order('sort_order');
  const pmap = Object.fromEntries((positions || []).map(p => [p.id, p.title]));
  const { data: cands } = await sb.from('candidates').select('id, name').eq('election_id', election_id);
  const cmap = Object.fromEntries((cands || []).map(c => [c.id, c.name]));

  // first vote time + per-position choices, per member
  const byMember = {};
  for (const v of votes || []) {
    const m = byMember[v.member_id] || (byMember[v.member_id] = { positions: 0, at: v.created_at, choices: [] });
    m.positions += 1;
    m.choices.push({ position: pmap[v.position_id] || 'Position', candidate: cmap[v.candidate_id] || '—' });
    if (v.created_at < m.at) m.at = v.created_at;
  }
  const ids = Object.keys(byMember);
  if (!ids.length) return ok({ voters: [], total: 0, note: `Election ${election_id} has 0 vote rows.` });

  const { data: members, error: memErr } = await sb.from('members')
    .select('id, member_code, full_name, gender, email, mobile, village, union_id, status, created_at')
    .in('id', ids);
  if (memErr) return fail('MEM_ERR', 500, { message: 'Could not read members.', detail: memErr.message });
  const { data: unions } = await sb.from('unions').select('id, union_name');
  const umap = Object.fromEntries((unions || []).map(u => [u.id, u.union_name]));
  const { data: receipts } = await sb.from('vote_receipts')
    .select('member_id, receipt_code, created_at').eq('election_id', election_id);
  const rmap = Object.fromEntries((receipts || []).map(r => [r.member_id, r.receipt_code]));

  // Iterate over EVERY voter (each unique member_id that has votes), then attach
  // member details when available. A voter whose member row is missing still appears,
  // so the list count always matches the real number of ballots cast.
  const mmap = Object.fromEntries((members || []).map(m => [m.id, m]));
  const voters = ids.map(id => {
    const m = mmap[id] || {};
    const b = byMember[id] || {};
    return {
      member_code: m.member_code || '—', full_name: m.full_name || '(member record removed)',
      gender: m.gender || null, email: m.email || null, mobile: m.mobile || null,
      village: m.village || null, union_name: m.union_id ? (umap[m.union_id] || null) : null,
      status: m.status || null,
      voted_at: b.at || null,
      positions_voted: b.positions || 0,
      choices: (b.choices || []).sort((a, z) => a.position.localeCompare(z.position)),
      receipt_code: rmap[id] || null,
    };
  }).sort((a, b) => new Date(b.voted_at) - new Date(a.voted_at));

  return ok({ voters, total: voters.length });
  } catch (e) {
    return fail('VOTER_DATA_FAILED', 500, { message: 'Voter Data failed.', detail: e.message });
  }
}
