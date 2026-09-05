import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAdmin } from '@/lib/guard';
import { logAudit, clientIp } from '@/lib/audit';
import { ok, fail, readJson } from '@/lib/api';
import { vacancyFromBody } from '@/lib/cecWrite';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export async function PATCH(req, props) {
  const params = await props.params;
  const { admin, res } = await requireAdmin(req);if (res) return res;
  const b = await readJson(req);

  const { data, error } = await supabaseAdmin().from('cec_vacancies')
    .update(vacancyFromBody(b, { partial: true })).eq('id', params.id).select().maybeSingle();
  if (error) return fail('SAVE_FAILED', 500, { message: error.message });
  if (!data) return fail('NOT_FOUND', 404, { message: 'Position not found.' });

  await logAudit({ action: 'CEC_VACANCY_UPDATED', actor: admin.username, details: data.title || '', ip: clientIp(req) });
  return ok({ vacancy: data, message: 'Saved.' });
}

export async function DELETE(req, props) {
  const params = await props.params;
  const { admin, res } = await requireAdmin(req);if (res) return res;
  const sb = supabaseAdmin();

  // Applications are never deleted with the advert — the FK is ON DELETE SET
  // NULL, so submissions survive. Deleting a position that people applied for
  // would destroy the record of a selection process, so it is blocked and the
  // admin is told to close it instead.
  const { data: apps } = await sb.from('cec_applications').select('id').eq('vacancy_id', params.id);
  if (apps?.length) {
    return fail('HAS_APPLICATIONS', 409, {
      message: `${apps.length} application${apps.length === 1 ? ' has' : 's have'} been submitted for this position. Close it instead of deleting, so the applications keep their position name.`,
    });
  }

  const { data: before } = await sb.from('cec_vacancies').select('title').eq('id', params.id).maybeSingle();
  const { error } = await sb.from('cec_vacancies').delete().eq('id', params.id);
  if (error) return fail('DELETE_FAILED', 500, { message: error.message });

  await logAudit({ action: 'CEC_VACANCY_DELETED', actor: admin.username, details: before?.title || params.id, ip: clientIp(req) });
  return ok({ message: 'Position deleted.' });
}
