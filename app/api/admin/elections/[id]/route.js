import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAdmin } from '@/lib/guard';
import { logAudit, clientIp } from '@/lib/audit';
import { ok, fail, readJson } from '@/lib/api';
export const dynamic = 'force-dynamic';

export async function PATCH(req, { params }) {
  const { admin, res } = requireAdmin(req); if (res) return res;
  const sb = supabaseAdmin();
  const id = params.id;
  const b = await readJson(req);
  const patch = {};
  for (const f of ['title','description','starts_at','ends_at']) if (f in b) patch[f] = b[f] || null;

  if ('status' in b) {
    const allowed = ['Draft','Active','Paused','Ended'];
    if (!allowed.includes(b.status)) return fail('BAD_STATUS', 400, { message: 'Invalid status.' });
    if (b.status === 'Active') {
      const { data: e } = await sb.from('elections').select('voter_list_locked').eq('id', id).maybeSingle();
      if (!e?.voter_list_locked) return fail('NOT_LOCKED', 400, { message: 'Lock the voter list before starting the election.' });
    }
    patch.status = b.status;
  }
  if ('result_published' in b) {
    patch.result_published = !!b.result_published;
    patch.result_published_at = b.result_published ? new Date().toISOString() : null;
  }
  const { data, error } = await sb.from('elections').update(patch).eq('id', id).select().maybeSingle();
  if (error) return fail('UPDATE_FAILED', 500, { message: error.message });

  if ('status' in b) await logAudit({ action: `ELECTION_${b.status.toUpperCase()}`, actor: admin.username, details: data?.title, election_id: id, ip: clientIp(req) });
  if ('result_published' in b && b.result_published) await logAudit({ action: 'RESULT_PUBLISHED', actor: admin.username, details: data?.title, election_id: id, ip: clientIp(req) });
  return ok({ election: data });
}

export async function DELETE(req, { params }) {
  const { admin, res } = requireAdmin(req); if (res) return res;
  const sb = supabaseAdmin();
  const id = params.id;
  const { data: e } = await sb.from('elections').select('status, result_published, title').eq('id', id).maybeSingle();
  if (!e) return fail('NOT_FOUND', 404, { message: 'Election not found.' });
  const url = new URL(req.url);
  const force = url.searchParams.get('force') === '1';
  // Safe rule: drafts always deletable; anything with votes needs force=1 (typed confirm on the UI).
  const { count: voteCount } = await sb.from('votes').select('*', { count: 'exact', head: true }).eq('election_id', id);
  const { count: candCount } = await sb.from('candidates').select('*', { count: 'exact', head: true }).eq('election_id', id);
  if ((voteCount || candCount) && !force) {
    return fail('HAS_DATA', 409, {
      message: `This election has ${candCount || 0} candidate(s) and ${voteCount || 0} vote(s). Deleting it removes them too.`,
      votes: voteCount || 0, candidates: candCount || 0,
    });
  }
  const { error } = await sb.from('elections').delete().eq('id', id); // cascades positions/candidates/votes/etc.
  if (error) return fail('DELETE_FAILED', 500, { message: error.message });
  await logAudit({ action: 'ELECTION_DELETED', actor: admin.username, details: e.title, election_id: id, ip: clientIp(req) });
  return ok({});
}
