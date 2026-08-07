import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireSuperAdmin } from '@/lib/guard';
import { logAudit, clientIp } from '@/lib/audit';
import { ok, fail, readJson } from '@/lib/api';

export const dynamic = 'force-dynamic';

// Clears all votes for an election so it can be run again.
// Candidates, positions and members are NEVER touched.
export async function POST(req, { params }) {
  const { admin, res } = requireSuperAdmin(req); if (res) return res;
  const sb = supabaseAdmin();
  const id = params.id;
  const b = await readJson(req);
  const ip = clientIp(req);

  const { data: election } = await sb.from('elections').select('*').eq('id', id).maybeSingle();
  if (!election) return fail('NOT_FOUND', 404, { message: 'Election not found.' });

  const { count: voteCount } = await sb.from('votes')
    .select('*', { count: 'exact', head: true }).eq('election_id', id);

  // Must be confirmed by typing RESET — this destroys every ballot.
  if (b.confirm !== 'RESET')
    return fail('CONFIRM_REQUIRED', 400, {
      message: 'Type RESET to confirm.', votes: voteCount || 0,
    });

  await sb.from('votes').delete().eq('election_id', id);
  await sb.from('vote_receipts').delete().eq('election_id', id);
  await sb.from('otp_verifications').delete().eq('election_id', id);

  // Members become eligible to vote again
  const { data: allMembers } = await sb.from('members').select('id').eq('voting_status', 'Voted');
  if ((allMembers || []).length) {
    await sb.from('members').update({ voting_status: 'Not Voted', updated_at: new Date().toISOString() })
      .eq('voting_status', 'Voted');
  }

  // Optionally reopen the election and/or unlock the voter list
  const patch = { result_published: false };
  if (b.reopen) patch.status = 'Active';
  if (b.unlock) {
    await sb.from('locked_voter_list').delete().eq('election_id', id);
    patch.voter_list_locked = false; patch.locked_by = null; patch.locked_at = null;
  }
  await sb.from('elections').update(patch).eq('id', id);

  await logAudit({
    action: 'ELECTION_RESET', actor: admin?.username || 'super_admin',
    details: `${election.title} · ${voteCount || 0} vote(s) cleared${b.reopen ? ' · reopened' : ''}${b.unlock ? ' · voter list unlocked' : ''}`,
    election_id: id, ip,
  });

  return ok({ cleared_votes: voteCount || 0, reopened: !!b.reopen, unlocked: !!b.unlock });
}
