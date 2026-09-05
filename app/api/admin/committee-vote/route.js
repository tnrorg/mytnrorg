import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireSuperAdmin } from '@/lib/guard';
import { getActiveElection, isVotingOpen } from '@/lib/election';
import { makeReceiptCode } from '@/lib/receipt';
import { logAudit, clientIp } from '@/lib/audit';
import { ok, fail, readJson } from '@/lib/api';
export const dynamic = 'force-dynamic';

// GET → data for the committee-entry form: election, positions, candidates, remaining eligible voters.
export async function GET(req) {
  const { res } = await requireSuperAdmin(req); if (res) return res;
  const sb = supabaseAdmin();
  const e = await getActiveElection();
  if (!e) return ok({ election: null, positions: [], candidates: [], remaining: [] });

  const { data: positions } = await sb.from('positions').select('*').eq('election_id', e.id).order('sort_order');
  const { data: candidates } = await sb.from('candidates').select('id, name, symbol, position_id, status').eq('election_id', e.id).eq('status', 'Active').order('sort_order');
  const { data: appr } = await sb.from('members').select('id, full_name, mobile').eq('status', 'Approved');
  const { data: voted } = await sb.from('votes').select('member_id').eq('election_id', e.id);
  const votedSet = new Set((voted || []).map(v => v.member_id));
  const remaining = (appr || []).filter(m => !votedSet.has(m.id))
    .map(m => ({ id: m.id, full_name: m.full_name, mobile: m.mobile }));

  return ok({
    election: { id: e.id, title: e.title, status: e.status, voting_open: isVotingOpen(e) },
    positions: positions || [], candidates: candidates || [], remaining,
  });
}

// POST → record ONE COMPLETE ballot for a remaining eligible voter:
// exactly one candidate for EVERY position, all inserted together — same rules
// as the member voting flow.
export async function POST(req) {
  const { admin, res } = await requireSuperAdmin(req); if (res) return res;
  const sb = supabaseAdmin();
  const body = await readJson(req);
  const member_id = body.member_id;
  const selections = Array.isArray(body.selections) ? body.selections : null;
  const ip = clientIp(req);

  if (!member_id) return fail('MISSING', 400, { message: 'Select a voter.' });
  if (!selections || !selections.length)
    return fail('INCOMPLETE_BALLOT', 400, { message: 'Select one candidate for every position before submitting the ballot.' });

  const e = await getActiveElection();
  if (!e) return fail('NO_ELECTION', 400, { message: 'No election available.' });
  if (!isVotingOpen(e)) return fail('NOT_ACTIVE', 403, { message: 'Election is not currently active.' });

  // Voter must be approved.
  const { data: member } = await sb.from('members').select('id, full_name, status').eq('id', member_id).maybeSingle();
  if (!member) return fail('NO_VOTER', 404, { message: 'Voter not found.' });
  if (member.status !== 'Approved') return fail('NOT_ELIGIBLE', 403, { message: 'Voter is not approved/eligible.' });

  // Every active position must be covered exactly once.
  const { data: positions } = await sb.from('positions').select('id, title')
    .eq('election_id', e.id).order('sort_order').order('id');
  const required = positions || [];
  if (!required.length) return fail('NO_POSITIONS', 400, { message: 'This election has no positions configured.' });

  const ids = selections.map(s => s.candidate_id).filter(Boolean);
  const { data: cands } = await sb.from('candidates').select('id, position_id, status')
    .eq('election_id', e.id).in('id', ids);
  const byId = new Map((cands || []).map(c => [c.id, c]));

  const rows = [];
  const seen = new Set();
  for (const s of selections) {
    const c = byId.get(s.candidate_id);
    if (!c || c.status !== 'Active') return fail('BAD_CANDIDATE', 400, { message: 'Invalid candidate selection.' });
    if (!c.position_id) return fail('BAD_CANDIDATE', 400, { message: 'A selected candidate is not assigned to a position.' });
    if (seen.has(c.position_id)) return fail('DUPLICATE_POSITION', 400, { message: 'Only one candidate may be selected per position.' });
    seen.add(c.position_id);
    rows.push({ election_id: e.id, member_id, candidate_id: c.id, position_id: c.position_id });
  }
  const missing = required.filter(p => !seen.has(p.id));
  if (missing.length)
    return fail('INCOMPLETE_BALLOT', 400, {
      message: 'Select one candidate for every position. Missing: ' + missing.map(p => p.title).join(', '),
    });

  // Duplicate protection: ANY existing vote (online or committee) blocks a second ballot.
  const { count: already } = await sb.from('votes')
    .select('*', { count: 'exact', head: true }).eq('election_id', e.id).eq('member_id', member_id);
  if (already) return fail('ALREADY_VOTED', 409, { message: 'This voter has already cast a ballot. Duplicate voting is not allowed.' });

  // Single atomic INSERT — all positions or none.
  const { error: insErr } = await sb.from('votes').insert(rows);
  if (insErr) {
    if (insErr.code === '23505') return fail('ALREADY_VOTED', 409, { message: 'This voter has already cast a ballot.' });
    return fail('VOTE_FAILED', 500, { message: 'Could not record the ballot. No votes were saved.' });
  }

  const receipt_code = makeReceiptCode();
  await sb.from('vote_receipts').insert({ election_id: e.id, member_id, receipt_code });
  await sb.from('members').update({ voting_status: 'Voted', updated_at: new Date().toISOString() }).eq('id', member_id);
  // Protected super-admin-only record of who entered it (one row per position).
  for (const r of rows) {
    await sb.from('committee_vote_entries').insert({ ...r, entered_by: admin.username }).then(() => {}, () => {});
  }
  await logAudit({ action: 'COMMITTEE_VOTE_ENTRY', actor: admin.username, details: `voter ${member_id} · ${rows.length} position(s) · receipt ${receipt_code}`, election_id: e.id, ip });

  return ok({ receipt_code, positions_voted: rows.length, message: 'Complete ballot recorded.' });
}
