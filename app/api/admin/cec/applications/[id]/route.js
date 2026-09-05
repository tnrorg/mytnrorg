import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAdmin, isSuperAdmin } from '@/lib/guard';
import { sendNotice } from '@/lib/mailer';
import { logAudit, clientIp } from '@/lib/audit';
import { ok, fail, readJson } from '@/lib/api';
import { reviewFromBody } from '@/lib/cecWrite';
import { APP_STATUS_LABEL } from '@/lib/cec';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

/* Which outcomes the applicant is emailed about, and what they are told.
 *
 * Deliberately not every status. "Shortlisted" and "Interviewed" are internal
 * bookkeeping — telling someone they are shortlisted before the panel has
 * finished creates an expectation the panel has not agreed to. Only the two
 * final outcomes go out, plus the interview invitation which the applicant
 * genuinely needs in advance. */
const NOTIFY = {
  interviewed: (a) => ({
    subject: `TNR — interview for ${a.reference_no || 'your application'}`,
    heading: 'You have been invited to interview',
    body: `Dear ${a.full_name},\n\nThe selection panel has reviewed your application `
      + `and would like to invite you to an interview. A member of the panel will `
      + `contact you on ${a.mobile || 'the number you provided'} to arrange a time.`
      + `\n\nReference: ${a.reference_no || '—'}`,
  }),
  selected: (a) => ({
    subject: 'TNR — your application has been successful',
    heading: 'Congratulations',
    body: `Dear ${a.full_name},\n\nFollowing the selection process, you have been `
      + `appointed to the position you applied for on the Central Executive Committee `
      + `of Tehreek-e-Nojawanan Roundu.\n\nA member of the leadership will be in touch `
      + `about taking up the role.\n\nReference: ${a.reference_no || '—'}`,
  }),
  not_selected: (a) => ({
    subject: 'TNR — update on your application',
    heading: 'Thank you for applying',
    body: `Dear ${a.full_name},\n\nThank you for applying and for the time you put `
      + `into your application. On this occasion the panel has selected another `
      + `candidate.\n\nWe would encourage you to apply again when future positions `
      + `are advertised, and to stay involved with TNR in the meantime.`
      + `\n\nReference: ${a.reference_no || '—'}`,
  }),
};

export async function PATCH(req, props) {
  const params = await props.params;
  const { admin, res } = await requireAdmin(req);if (res) return res;
  const b = await readJson(req);

  // Only a Super Admin may change the outcome. Any admin — and any CEC member
  // reading in their portal — can record an opinion in the notes, but moving
  // an application to Selected or Not selected is the decision itself, and
  // that authority is not spread across every admin account.
  if ('status' in b && !isSuperAdmin(admin)) {
    return fail('FORBIDDEN', 403, {
      message: 'Only a Super Admin can change an application\'s decision. You can still add panel notes.',
    });
  }

  const patch = reviewFromBody(b, admin.username);
  const { data, error } = await supabaseAdmin().from('cec_applications')
    .update(patch).eq('id', params.id).select().maybeSingle();
  if (error) return fail('SAVE_FAILED', 500, { message: error.message });
  if (!data) return fail('NOT_FOUND', 404, { message: 'Application not found.' });

  // Tell the applicant, but only for the outcomes that are theirs to hear.
  // "Shortlisted" and internal notes stay internal until the panel is ready.
  if (patch.status && NOTIFY[patch.status] && data.email) {
    const note = NOTIFY[patch.status](data);
    try {
      await sendNotice({
        to: data.email, subject: note.subject, heading: note.heading, body: note.body,
      });
    } catch { /* the decision is recorded either way — email must not block it */ }
  }

  await logAudit({
    action: 'CEC_APPLICATION_REVIEWED', actor: admin.username,
    details: `${data.full_name || data.reference_no || params.id}` +
      (patch.status ? ` → ${APP_STATUS_LABEL[patch.status]}` : ' — notes updated'),
    ip: clientIp(req),
  });
  return ok({ application: data, message: 'Saved.' });
}

export async function DELETE(req, props) {
  const params = await props.params;
  const { admin, res } = await requireAdmin(req);if (res) return res;
  const sb = supabaseAdmin();

  const { data: before } = await sb.from('cec_applications')
    .select('full_name, reference_no').eq('id', params.id).maybeSingle();
  const { error } = await sb.from('cec_applications').delete().eq('id', params.id);
  if (error) return fail('DELETE_FAILED', 500, { message: error.message });

  await logAudit({
    action: 'CEC_APPLICATION_DELETED', actor: admin.username,
    details: before?.reference_no || before?.full_name || params.id, ip: clientIp(req),
  });
  return ok({ message: 'Application deleted.' });
}
