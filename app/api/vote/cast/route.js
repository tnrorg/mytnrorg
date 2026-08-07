import { supabaseAdmin } from '@/lib/supabaseServer';
import { verifyVoteToken } from '@/lib/voteToken';
import { makeReceiptCode } from '@/lib/receipt';
import { isVotingOpen } from '@/lib/election';
import { logAudit, clientIp } from '@/lib/audit';
import { ok, fail, readJson } from '@/lib/api';

export const dynamic = 'force-dynamic';

// Casts a COMPLETE ballot: exactly one candidate for every active position.
// All rows are written in a single INSERT statement, so Postgres commits them
// together or not at all — a partial ballot can never be stored.
export async function POST(req) {
  const sb = supabaseAdmin();
  const body = await readJson(req);
  const { vote_token } = body;
  const ip = clientIp(req);

  const claim = verifyVoteToken(vote_token);
  if (!claim) return fail('INVALID_SESSION', 401, { message: 'Your voting session has expired. Please verify your email again.' });
  const { election_id, member_id } = claim;

  // Accept the new ballot format, and a single candidate_id for backward compatibility.
  let selections = Array.isArray(body.selections) ? body.selections : null;
  if (!selections && body.candidate_id) selections = [{ candidate_id: body.candidate_id }];
  if (!selections || !selections.length)
    return fail('NO_SELECTION', 400, { message: 'Please select one candidate for every election position before submitting your ballot.' });

  const { data: election } = await sb.from('elections').select('*').eq('id', election_id).maybeSingle();
  if (!isVotingOpen(election)) return fail('NOT_ACTIVE', 403, { message: 'Voting is not currently open for this election.' });

  // Which positions must be filled?
  const { data: positions } = await sb.from('positions').select('id, title')
    .eq('election_id', election_id).order('sort_order').order('id');
  const required = positions || [];
  if (!required.length) return fail('NO_POSITIONS', 400, { message: 'This election has no positions configured.' });

  // Every candidate must be active and belong to this election
  const ids = selections.map(s => s.candidate_id).filter(Boolean);
  const { data: cands } = await sb.from('candidates').select('id, position_id, status, name')
    .eq('election_id', election_id).in('id', ids);
  const byId = new Map((cands || []).map(c => [c.id, c]));

  const rows = [];
  const seen = new Set();
  for (const s of selections) {
    const c = byId.get(s.candidate_id);
    if (!c || c.status !== 'Active') return fail('BAD_CANDIDATE', 400, { message: 'Invalid candidate selection.' });
    if (!c.position_id) return fail('BAD_CANDIDATE', 400, { message: 'A selected candidate is not assigned to a position.' });
    if (seen.has(c.position_id))
      return fail('DUPLICATE_POSITION', 400, { message: 'Only one candidate may be selected for each position.' });
    seen.add(c.position_id);
    rows.push({ election_id, member_id, candidate_id: c.id, position_id: c.position_id });
  }

  // Ballot must be complete — every active position covered
  const missing = required.filter(p => !seen.has(p.id));
  if (missing.length)
    return fail('INCOMPLETE_BALLOT', 400, {
      message: 'Please select one candidate for every election position before submitting your ballot.',
      missing: missing.map(p => p.title),
    });

  // Already voted? (checked up front for a clean message)
  const { count: already } = await sb.from('votes')
    .select('*', { count: 'exact', head: true }).eq('election_id', election_id).eq('member_id', member_id);
  if (already) {
    await logAudit({ action: 'DUPLICATE_VOTE_ATTEMPT', actor: 'member', details: member_id, election_id, ip });
    return fail('ALREADY_VOTED', 409, { message: 'You have already cast your ballot. Duplicate voting is not allowed.' });
  }

  // Single atomic INSERT — all positions or none
  const { error: insErr } = await sb.from('votes').insert(rows);
  if (insErr) {
    if (insErr.code === '23505') {
      await logAudit({ action: 'DUPLICATE_VOTE_ATTEMPT', actor: 'member', details: member_id, election_id, ip });
      return fail('ALREADY_VOTED', 409, { message: 'You have already cast your ballot. Duplicate voting is not allowed.' });
    }
    await logAudit({ action: 'VOTE_FAILED', actor: 'system', details: insErr.message, election_id, ip });
    return fail('VOTE_FAILED', 500, { message: 'Could not record your ballot. No votes were saved. Please try again.' });
  }

  const receipt_code = makeReceiptCode();
  await sb.from('vote_receipts').insert({ election_id, member_id, receipt_code });
  await sb.from('members').update({ voting_status: 'Voted', updated_at: new Date().toISOString() }).eq('id', member_id);
  await logAudit({
    action: 'VOTE_SUBMITTED', actor: 'member',
    details: `receipt ${receipt_code} · ${rows.length} position(s)`, election_id, ip,
  });

  return ok({ receipt_code, positions_voted: rows.length, message: 'Your ballot has been submitted successfully.' });
}
