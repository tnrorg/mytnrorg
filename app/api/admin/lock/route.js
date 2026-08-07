import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAdmin } from '@/lib/guard';
import { logAudit, clientIp } from '@/lib/audit';
import { ok, fail, readJson } from '@/lib/api';
export const dynamic = 'force-dynamic';

// Lock the final voter list for an election. Eligible = Approved members,
// optionally filtered to an explicit member_ids array. Idempotent-ish: refuses if already locked.
export async function POST(req) {
  const { admin, res } = requireAdmin(req); if (res) return res;
  const sb = supabaseAdmin();
  const { election_id, member_ids } = await readJson(req);
  if (!election_id) return fail('MISSING', 400, { message: 'election_id required.' });

  const { data: e } = await sb.from('elections').select('*').eq('id', election_id).maybeSingle();
  if (!e) return fail('NOT_FOUND', 404, { message: 'Election not found.' });
  if (e.voter_list_locked) return fail('ALREADY_LOCKED', 409, { message: 'Voter list is already locked.' });

  let q = sb.from('members').select('id, full_name, mobile, union_id').eq('status', 'Approved');
  if (Array.isArray(member_ids) && member_ids.length) q = q.in('id', member_ids);
  const { data: members } = await q;
  if (!members || !members.length) return fail('NO_MEMBERS', 400, { message: 'No approved members to lock.' });

  const snapshot = members.map(m => ({
    election_id, member_id: m.id, full_name: m.full_name, mobile: m.mobile, union_id: m.union_id,
  }));
  const { error: insErr } = await sb.from('locked_voter_list').insert(snapshot);
  if (insErr) return fail('LOCK_FAILED', 500, { message: insErr.message });

  const locked_at = new Date().toISOString();
  await sb.from('elections').update({ voter_list_locked: true, locked_at, locked_by: admin.username }).eq('id', election_id);
  await logAudit({ action: 'VOTER_LIST_LOCKED', actor: admin.username, details: `${snapshot.length} voters locked`, election_id, ip: clientIp(req) });
  return ok({ locked_count: snapshot.length, locked_at, locked_by: admin.username });
}

// GET → locked snapshot summary
export async function GET(req) {
  const { res } = requireAdmin(req); if (res) return res;
  const sb = supabaseAdmin();
  const url = new URL(req.url);
  const election_id = url.searchParams.get('election_id');
  if (!election_id) return fail('MISSING', 400, { message: 'election_id required.' });
  const { data: e } = await sb.from('elections').select('voter_list_locked, locked_at, locked_by').eq('id', election_id).maybeSingle();
  const { count } = await sb.from('locked_voter_list').select('*', { count: 'exact', head: true }).eq('election_id', election_id);
  return ok({ locked: !!e?.voter_list_locked, locked_at: e?.locked_at, locked_by: e?.locked_by, count: count || 0 });
}
