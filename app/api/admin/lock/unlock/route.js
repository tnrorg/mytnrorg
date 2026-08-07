import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAdmin } from '@/lib/guard';
import { logAudit, clientIp } from '@/lib/audit';
import { ok, fail, readJson } from '@/lib/api';

export const dynamic = 'force-dynamic';

// Unlocks the voter list: clears the locked snapshot so EVERY approved member
// becomes eligible again. Votes are untouched.
export async function POST(req) {
  const { admin, res } = requireAdmin(req); if (res) return res;
  const sb = supabaseAdmin();
  const { election_id } = await readJson(req);
  if (!election_id) return fail('INVALID', 400, { message: 'election_id is required.' });

  const { data: election } = await sb.from('elections').select('*').eq('id', election_id).maybeSingle();
  if (!election) return fail('NOT_FOUND', 404, { message: 'Election not found.' });

  const { count } = await sb.from('locked_voter_list')
    .select('*', { count: 'exact', head: true }).eq('election_id', election_id);

  await sb.from('locked_voter_list').delete().eq('election_id', election_id);
  await sb.from('elections').update({
    voter_list_locked: false, locked_by: null, locked_at: null,
  }).eq('id', election_id);

  await logAudit({
    action: 'VOTER_LIST_UNLOCKED', actor: admin.username,
    details: `${count || 0} entries cleared — all approved members may now vote`,
    election_id, ip: clientIp(req),
  });
  return ok({ unlocked: true, cleared: count || 0 });
}
