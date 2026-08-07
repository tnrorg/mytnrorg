import { supabaseAdmin } from '@/lib/supabaseServer';
import { verifyVoteToken } from '@/lib/voteToken';
import { ok, fail, readJson } from '@/lib/api';
export const dynamic = 'force-dynamic';
export async function POST(req) {
  const sb = supabaseAdmin();
  const { vote_token } = await readJson(req);
  const claim = verifyVoteToken(vote_token);
  if (!claim) return fail('INVALID_SESSION', 401, { message: 'Please verify your number again.' });

  const { data: positions } = await sb.from('positions').select('*')
    .eq('election_id', claim.election_id).order('sort_order');
  const { data: candidates } = await sb.from('candidates').select('*')
    .eq('election_id', claim.election_id).eq('status', 'Active').order('sort_order');
  const { data: unions } = await sb.from('unions').select('id, union_name');
  const umap = Object.fromEntries((unions || []).map(u => [u.id, u.union_name]));
  const enriched = (candidates || []).map(c => ({ ...c, union_name: umap[c.union_id] || null }));
  return ok({ positions: positions || [], candidates: enriched });
}
