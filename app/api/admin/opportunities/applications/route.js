import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAdmin } from '@/lib/guard';
import { logAudit, clientIp } from '@/lib/audit';
import { ok, fail, readJson } from '@/lib/api';
import { APP_STATUSES, INTERVIEW_MODES, FELLOWSHIP_QUESTIONS } from '@/lib/opportunities';
import { sendApplicationEmail } from '@/lib/opportunityEmails';
import { notifyMember } from '@/lib/notify';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const HINT = 'Administrator: run supabase/migration_opportunities_v2.sql.';

/* Applications review.
 *
 * Member details are read LIVE from membership_members and joined here rather
 * than copied onto the application when it was submitted. A member who
 * corrects their phone number is then correct in every application they have
 * ever made, instead of leaving a stale copy behind in each one.
 */

const MEMBER_COLUMNS =
  'id, membership_id, full_name, first_name, last_name, email, mobile, gender, ' +
  'date_of_birth, education_level, profession, field_of_study, current_position, ' +
  'village, union_council, photo_url';

export async function GET(req) {
  const { res } = requireAdmin(req); if (res) return res;
  const p = new URL(req.url).searchParams;
  const oppId = (p.get('opportunity_id') || '').trim();
  const status = (p.get('status') || '').trim();
  const one = (p.get('id') || '').trim();

  const sb = supabaseAdmin();

  // ── One application, in full ──
  if (one) {
    const { data: a } = await sb.from('opportunity_applications')
      .select('*').eq('id', one).maybeSingle();
    if (!a) return fail('NOT_FOUND', 404, { message: 'Application not found.' });

    const [{ data: m }, { data: o }, { data: hist }] = await Promise.all([
      sb.from('membership_members').select(MEMBER_COLUMNS).eq('id', a.member_id).maybeSingle(),
      sb.from('opportunities').select('id, title, category, organization').eq('id', a.opportunity_id).maybeSingle(),
      sb.from('opportunity_application_history')
        .select('*').eq('application_id', one).order('created_at', { ascending: false }),
    ]);

    return ok({
      application: a, member: m || null, opportunity: o || null,
      history: hist || [], questions: FELLOWSHIP_QUESTIONS,
    });
  }

  // ── The table ──
  let q = sb.from('opportunity_applications').select('*')
    .order('submitted_at', { ascending: false }).limit(500);
  if (oppId) q = q.eq('opportunity_id', oppId);
  if (status && APP_STATUSES.includes(status)) q = q.eq('status', status);

  const { data: apps, error } = await q;
  if (error) return ok({ applications: [], stats: {}, hint: HINT });

  const rows = apps || [];
  let members = {}, opps = {};
  if (rows.length) {
    const [{ data: mem }, { data: op }] = await Promise.all([
      sb.from('membership_members').select(MEMBER_COLUMNS)
        .in('id', [...new Set(rows.map(r => r.member_id))]),
      sb.from('opportunities').select('id, title, category')
        .in('id', [...new Set(rows.map(r => r.opportunity_id))]),
    ]);
    members = Object.fromEntries((mem || []).map(m => [m.id, m]));
    opps = Object.fromEntries((op || []).map(o => [o.id, o]));
  }

  const stats = { total: rows.length };
  for (const s of APP_STATUSES) stats[s] = rows.filter(r => r.status === s).length;

  return ok({
    stats,
    questions: FELLOWSHIP_QUESTIONS,
    applications: rows.map(a => ({
      ...a,
      member: members[a.member_id] || null,
      opportunity: opps[a.opportunity_id] || null,
    })),
  });
}

/* Change status, record history, notify.
 *
 * THE ORDER MATTERS AND IS DELIBERATE:
 *   1. verify the transition is real (idempotency guard)
 *   2. update the application
 *   3. write history
 *   4. send the email
 *   5. record whether it went
 *
 * The email is LAST because a failure there must not undo a decision the
 * committee has made. If the mail server is down the applicant is still
 * shortlisted, the admin is told plainly, and Retry Email sends it later
 * without touching the status again.
 */
export async function POST(req) {
  const { admin, res } = requireAdmin(req); if (res) return res;
  const b = await readJson(req);
  const sb = supabaseAdmin();

  /* ── Bulk decision ──
   *
   * One set of interview details sent to many shortlisted applicants.
   *
   * Processed in SMALL BATCHES, with the client looping until done. Each
   * applicant costs a database write plus an SMTP round trip, and thirty of
   * those in one request will hit the serverless time limit — at which point
   * the connection drops mid-run and nobody, including the admin, knows how
   * many emails went out. Ten at a time finishes well inside the limit and
   * reports exactly what happened. */
  if (Array.isArray(b.ids)) return bulk(sb, b, admin, req);

  const id = String(b.id || '').trim();
  if (!id) return fail('INVALID', 400, { message: 'Missing application.' });

  // ── Retry a failed email, without re-deciding anything ──
  if (b.action === 'retry_email') return retryEmail(sb, id, admin, req);

  const to = String(b.status || '').trim();
  if (!APP_STATUSES.includes(to) || to === 'submitted' || to === 'withdrawn')
    return fail('INVALID', 400, { message: 'Not a decision that can be applied here.' });

  const { data: app } = await sb.from('opportunity_applications')
    .select('*').eq('id', id).maybeSingle();
  if (!app) return fail('NOT_FOUND', 404, { message: 'Application not found.' });

  /* Already there — do nothing, send nothing.
   *
   * This is the guard against a double-click, a refresh that re-posts, and a
   * network retry after a response was lost. Without it the second request
   * would send the applicant a second identical email, which is the failure
   * people actually notice. */
  if (app.status === to)
    return ok({ application: app, unchanged: true, message: `Already marked ${to.replace('_', ' ')}.` });

  let interview = null;
  if (to === 'interview_invited') {
    const i = b.interview || {};
    if (!String(i.date || '').trim() || !String(i.time || '').trim())
      return fail('INVALID', 400, { message: 'Interview date and time are required.' });
    interview = {
      date: String(i.date).trim().slice(0, 40),
      time: String(i.time).trim().slice(0, 40),
      mode: INTERVIEW_MODES.includes(i.mode) ? i.mode : 'Online',
      venue: String(i.venue || '').trim().slice(0, 300),
      notes: String(i.notes || '').trim().slice(0, 600),
    };
  }

  const now = new Date().toISOString();
  const { data: updated, error } = await sb.from('opportunity_applications')
    .update({ status: to, updated_at: now, ...(interview ? { interview } : {}) })
    .eq('id', id).select('*').single();
  if (error) return fail('UPDATE_FAILED', 500, { message: 'Could not update the application.', detail: error.message });

  const [{ data: member }, { data: opportunity }] = await Promise.all([
    sb.from('membership_members').select(MEMBER_COLUMNS).eq('id', app.member_id).maybeSingle(),
    sb.from('opportunities').select('id, title').eq('id', app.opportunity_id).maybeSingle(),
  ]);

  const { data: hist } = await sb.from('opportunity_application_history').insert({
    application_id: id, opportunity_id: app.opportunity_id, member_id: app.member_id,
    from_status: app.status, to_status: to,
    changed_by: admin?.username || 'admin',
    interview, email_status: 'pending',
  }).select('id').single();

  const mail = await sendApplicationEmail({
    status: to, member, opportunity: opportunity || { title: 'Opportunity' }, interview,
  });

  if (hist?.id) {
    await sb.from('opportunity_application_history').update({
      email_status: mail.skipped ? 'not_required' : (mail.sent ? 'sent' : 'failed'),
      email_error: mail.error || null,
      email_sent_at: mail.sent ? new Date().toISOString() : null,
    }).eq('id', hist.id);
  }

  // The portal bell, independent of email — a member who never opens their
  // inbox still sees the decision where they applied.
  await notifyMember({
    memberId: app.member_id,
    title: `${opportunity?.title || 'Opportunity'} — ${to.replace('_', ' ')}`,
    body: 'Open your Opportunities page to see the details.',
    link: '/member/opportunities', category: 'opportunity',
  });

  await logAudit({
    action: `APPLICATION_${to.toUpperCase()}`, actor: admin?.username || 'admin',
    details: `${member?.membership_id || ''} — ${opportunity?.title || ''}`.slice(0, 200),
    ip: clientIp(req),
  });

  return ok({
    application: updated,
    email: { sent: mail.sent, error: mail.error || null, skipped: !!mail.skipped },
    message: mail.sent
      ? 'Status updated and notification email sent.'
      : mail.skipped ? 'Status updated.'
        : 'Application status updated, but the notification email could not be sent.',
  });
}

/* One decision applied to many applicants.
 *
 * The client sends a CHUNK of ids at a time and calls again until its list is
 * exhausted, so a run of thirty never sits in one request. The cap below is
 * enforced here as well — a client that ignores the chunk size still cannot
 * make the server attempt thirty SMTP sends in one invocation.
 *
 * Every applicant is processed independently and reported individually. One
 * bad email address must not stop the other twenty-eight invitations, and the
 * admin must be able to see WHICH one failed rather than being told "some
 * failed".
 */
const BULK_CHUNK = 8;

async function bulk(sb, b, admin, req) {
  const to = String(b.status || '').trim();
  if (!APP_STATUSES.includes(to) || to === 'submitted' || to === 'withdrawn')
    return fail('INVALID', 400, { message: 'Not a decision that can be applied here.' });

  const ids = [...new Set(b.ids.map(x => String(x || '').trim()).filter(Boolean))].slice(0, BULK_CHUNK);
  if (!ids.length) return fail('INVALID', 400, { message: 'No applications selected.' });

  let interview = null;
  if (to === 'interview_invited') {
    const i = b.interview || {};
    if (!String(i.date || '').trim() || !String(i.time || '').trim())
      return fail('INVALID', 400, { message: 'Interview date and time are required.' });
    interview = {
      date: String(i.date).trim().slice(0, 40),
      time: String(i.time).trim().slice(0, 40),
      mode: INTERVIEW_MODES.includes(i.mode) ? i.mode : 'Online',
      venue: String(i.venue || '').trim().slice(0, 300),
      notes: String(i.notes || '').trim().slice(0, 600),
    };
  }

  const { data: apps } = await sb.from('opportunity_applications').select('*').in('id', ids);
  const rows = apps || [];

  // Members and opportunities for the whole chunk in two queries rather than
  // two per applicant.
  const [{ data: mem }, { data: opp }] = await Promise.all([
    sb.from('membership_members').select(MEMBER_COLUMNS)
      .in('id', [...new Set(rows.map(r => r.member_id))]),
    sb.from('opportunities').select('id, title')
      .in('id', [...new Set(rows.map(r => r.opportunity_id))]),
  ]);
  const members = Object.fromEntries((mem || []).map(m => [m.id, m]));
  const opps = Object.fromEntries((opp || []).map(o => [o.id, o]));

  const results = [];
  const now = new Date().toISOString();

  for (const id of ids) {
    const app = rows.find(r => r.id === id);
    const member = app ? members[app.member_id] : null;
    const name = member?.full_name || member?.membership_id || 'Applicant';

    if (!app) { results.push({ id, name, state: 'missing', note: 'Application not found.' }); continue; }

    // Same guard as the single decision: never email someone twice because
    // they were already in this state before the run started.
    if (app.status === to) { results.push({ id, name, state: 'skipped', note: 'Already at this status.' }); continue; }

    const { error } = await sb.from('opportunity_applications')
      .update({ status: to, updated_at: now, ...(interview ? { interview } : {}) }).eq('id', id);
    if (error) { results.push({ id, name, state: 'failed', note: 'Could not update.' }); continue; }

    const opportunity = opps[app.opportunity_id] || { title: 'Opportunity' };

    const { data: hist } = await sb.from('opportunity_application_history').insert({
      application_id: id, opportunity_id: app.opportunity_id, member_id: app.member_id,
      from_status: app.status, to_status: to,
      changed_by: admin?.username || 'admin',
      interview, email_status: 'pending',
    }).select('id').single();

    const mail = await sendApplicationEmail({ status: to, member, opportunity, interview });

    if (hist?.id) {
      await sb.from('opportunity_application_history').update({
        email_status: mail.skipped ? 'not_required' : (mail.sent ? 'sent' : 'failed'),
        email_error: mail.error || null,
        email_sent_at: mail.sent ? new Date().toISOString() : null,
      }).eq('id', hist.id);
    }

    await notifyMember({
      memberId: app.member_id,
      title: `${opportunity.title} — ${to.replace('_', ' ')}`,
      body: 'Open your Opportunities page to see the details.',
      link: '/member/opportunities', category: 'opportunity',
    });

    /* The status change stands even when the email does not go.
     * `email_failed` is deliberately NOT `failed` — the committee's decision
     * was recorded, only the message needs resending, and Retry Email on that
     * row will do it without touching the status again. */
    results.push({
      id, name,
      state: (mail.sent || mail.skipped) ? 'done' : 'email_failed',
      note: mail.error || null,
    });
  }

  await logAudit({
    action: `APPLICATION_BULK_${to.toUpperCase()}`, actor: admin?.username || 'admin',
    details: `${results.filter(r => r.state === 'done').length}/${ids.length} applied`,
    ip: clientIp(req),
  });

  return ok({ results, chunk: ids.length });
}

/** Resend the email for the most recent decision. Status is not touched. */
async function retryEmail(sb, id, admin, req) {
  const { data: app } = await sb.from('opportunity_applications').select('*').eq('id', id).maybeSingle();
  if (!app) return fail('NOT_FOUND', 404, { message: 'Application not found.' });

  const [{ data: member }, { data: opportunity }, { data: last }] = await Promise.all([
    sb.from('membership_members').select(MEMBER_COLUMNS).eq('id', app.member_id).maybeSingle(),
    sb.from('opportunities').select('id, title').eq('id', app.opportunity_id).maybeSingle(),
    sb.from('opportunity_application_history').select('id, to_status, interview')
      .eq('application_id', id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ]);

  const mail = await sendApplicationEmail({
    status: app.status, member, opportunity: opportunity || { title: 'Opportunity' },
    interview: app.interview || last?.interview,
  });

  if (last?.id) {
    await sb.from('opportunity_application_history').update({
      email_status: mail.sent ? 'sent' : 'failed',
      email_error: mail.error || null,
      email_sent_at: mail.sent ? new Date().toISOString() : null,
    }).eq('id', last.id);
  }

  await logAudit({
    action: 'APPLICATION_EMAIL_RETRY', actor: admin?.username || 'admin',
    details: `${member?.membership_id || ''} — ${mail.sent ? 'sent' : 'failed'}`, ip: clientIp(req),
  });

  return mail.sent
    ? ok({ email: { sent: true }, message: 'Notification email sent.' })
    : fail('EMAIL_FAILED', 502, { message: mail.error || 'The email still could not be sent.' });
}
