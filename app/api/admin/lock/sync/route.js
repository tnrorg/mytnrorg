import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAdmin } from '@/lib/guard';
import { logAudit, clientIp } from '@/lib/audit';
import { ok, fail, readJson } from '@/lib/api';
export const dynamic = 'force-dynamic';

// Append newly-approved members to an ALREADY-LOCKED voter list (safe, additive only).
export async function POST(req) {
  const { admin, res } = requireAdmin(req); if (res) return res;
  const sb = supabaseAdmin();
  const { election_id } = await readJson(req);
  if (!election_id) return fail('MISSING', 400, { message: 'election_id required.' });

  const { data: e } = await sb.from('elections').select('voter_list_locked, title').eq('id', election_id).maybeSingle();
  if (!e) return fail('NOT_FOUND', 404, { message: 'Election not found.' });
  if (!e.voter_list_locked) return fail('NOT_LOCKED', 400, { message: 'Voter list is not locked yet. Use "Lock Voter List" first.' });

  // Approved members not already on the locked list
  const { data: approved } = await sb.from('members').select('id, full_name, mobile, union_id').eq('status', 'Approved');
  const { data: locked } = await sb.from('locked_voter_list').select('member_id').eq('election_id', election_id);
  const lockedSet = new Set((locked || []).map(l => l.member_id));
  const toAdd = (approved || []).filter(m => !lockedSet.has(m.id));
  if (!toAdd.length) return ok({ added: 0, message: 'No new approved voters to add.' });

  const snapshot = toAdd.map(m => ({ election_id, member_id: m.id, full_name: m.full_name, mobile: m.mobile, union_id: m.union_id }));
  const { error } = await sb.from('locked_voter_list').insert(snapshot);
  if (error) return fail('SYNC_FAILED', 500, { message: error.message });

  await logAudit({ action: 'VOTER_LIST_SYNCED', actor: admin.username, details: `${snapshot.length} new voters added`, election_id, ip: clientIp(req) });
  return ok({ added: snapshot.length });
}
