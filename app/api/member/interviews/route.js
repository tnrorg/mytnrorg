import { requireMember } from '@/lib/membership/auth';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { ok, fail, readJson } from '@/lib/api';
import { cleanCriteria, validateEvaluation, panelSummary } from '@/lib/interviews';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/* The interview panel, from a panellist's own portal.
 *
 * The people who judge a fellowship candidate are the Executive Committee and
 * the Advisory Council. Most of them have no admin login, and giving them one
 * so they could score would hand them the applications, the member records and
 * everything else the Opportunities area opens. So they score here instead.
 *
 * THE ACCESS RULE, stated once and checked on every single request:
 *
 *     a member sees a session only if there is a row for them in
 *     interview_panellists for that session.
 *
 * The member id comes from the verified session token. There is no member_id
 * parameter anywhere in this file. A candidate — who is also a member, with a
 * portal login of their own — must never be able to reach the queue they are
 * standing in, the notes taken about them, or anybody's scores. This function
 * is what stops them, because the service-role key means RLS never runs.
 */

// A candidate's name and what they wrote. Not their phone number, not their
// CNIC: a panellist judges the application, and needs nothing else.
const CANDIDATE_FIELDS = 'id, membership_id, full_name, photo_url, union_council';

/** The caller's seat on a session, or null. */
async function seatOf(sb, sessionId, memberId) {
  const { data, error } = await sb.from('interview_panellists')
    .select('id, role').eq('session_id', sessionId).eq('member_id', memberId).maybeSingle();
  return { seat: data || null, error };
}

export async function GET(req) {
  const { member, res } = await requireMember(req); if (res) return res;

  const sb = supabaseAdmin();
  const url = new URL(req.url);
  const sessionId = url.searchParams.get('session_id');

  // ── Which panels am I on? ────────────────────────────────────────────────
  const { data: seats, error: sErr } = await sb.from('interview_panellists')
    .select('session_id, role').eq('member_id', member.id);

  if (sErr) {
    /* The table is missing until the migration runs. Say so rather than
     * answering "you are on no panels", which is the same screen a panellist
     * would see if they had genuinely been left off — and they would ring the
     * office about the wrong problem. */
    return fail('NOT_READY', 503, {
      message: 'The interview panel is not set up yet. Please tell the office.',
    });
  }

  const mySessions = seats || [];
  if (!mySessions.length) return ok({ sessions: [], session: null });

  const ids = mySessions.map(s => s.session_id);
  const { data: sessions } = await sb.from('interview_sessions')
    .select('id, title, status, criteria, opportunity_id, meeting_id, created_at')
    .in('id', ids).order('created_at', { ascending: false });

  if (!sessionId) return ok({ sessions: sessions || [], session: null });

  // ── One session, if I am on it ───────────────────────────────────────────
  const { seat } = await seatOf(sb, sessionId, member.id);
  if (!seat) {
    return fail('NOT_ON_PANEL', 403, {
      message: 'You are not on this interview panel.',
    });
  }

  const session = (sessions || []).find(s => s.id === sessionId);
  if (!session) return fail('NOT_FOUND', 404, { message: 'Interview session not found.' });

  const criteria = cleanCriteria(session.criteria);

  const { data: queue } = await sb.from('interview_queue')
    .select('id, application_id, member_id, position, state, started_at, ended_at')
    .eq('session_id', sessionId).order('position');

  const rows = queue || [];
  const appIds = rows.map(q => q.application_id);
  const memberIds = rows.map(q => q.member_id);

  const apps = new Map();
  for (let i = 0; i < appIds.length; i += 100) {
    const { data } = await sb.from('opportunity_applications')
      .select('id, answers').in('id', appIds.slice(i, i + 100));
    for (const a of data || []) apps.set(a.id, a);
  }

  const people = new Map();
  for (let i = 0; i < memberIds.length; i += 100) {
    const { data } = await sb.from('membership_members')
      .select(CANDIDATE_FIELDS).in('id', memberIds.slice(i, i + 100));
    for (const m of data || []) people.set(m.id, m);
  }

  const { data: evals } = await sb.from('interview_evaluations')
    .select('*').eq('session_id', sessionId);

  const names = new Map();
  const panelIds = [...new Set((evals || []).map(e => e.panellist_member_id).filter(Boolean))];
  if (panelIds.length) {
    const { data } = await sb.from('membership_members')
      .select('id, full_name').in('id', panelIds);
    for (const m of data || []) names.set(m.id, m.full_name);
  }

  const byApp = new Map();
  for (const e of evals || []) {
    if (!byApp.has(e.application_id)) byApp.set(e.application_id, []);
    byApp.get(e.application_id).push(e);
  }

  const { data: panel } = await sb.from('interview_panellists')
    .select('member_id').eq('session_id', sessionId);

  /* The room itself.
   *
   * The interview happens in the TNR Virtual Hall; this screen is the notebook
   * beside it. Returning the meeting means the panellist opens the room from
   * here rather than hunting for it in My Meetings — and the state tells them
   * whether it has started, which is the question they actually have. */
  let meeting = null;
  if (session.meeting_id) {
    const { data } = await sb.from('meetings')
      .select('id, title, status, scheduled_at, duration_minutes')
      .eq('id', session.meeting_id).maybeSingle();
    meeting = data || null;
  }

  const out = rows.map(q => {
    const all = byApp.get(q.application_id) || [];
    const mine = all.find(e => e.panellist_member_id === member.id) || null;

    /* OTHERS' SCORES ARE WITHHELD UNTIL YOU HAVE FILED YOUR OWN.
     *
     * A panellist who reads "8.5" before forming a view does not produce an
     * independent judgement, and three dependent scores are worth less than
     * one honest one. This is enforced on the SERVER, not by hiding a panel in
     * the browser — otherwise the numbers are sitting in the response and
     * anyone curious can read them.
     *
     * Once you have saved, they open up: the point is independence at the
     * moment of judging, not secrecy afterwards. */
    const reveal = !!mine;

    return {
      ...q,
      candidate: people.get(q.member_id) || null,
      answers: apps.get(q.application_id)?.answers || {},
      my_evaluation: mine,
      others: reveal
        ? all.filter(e => e.panellist_member_id !== member.id)
          .map(e => ({
            id: e.id, scores: e.scores, notes: e.notes,
            recommendation: e.recommendation,
            panellist_name: names.get(e.panellist_member_id) || 'Panellist',
          }))
        : [],
      others_count: all.filter(e => e.panellist_member_id !== member.id).length,
      summary: reveal ? panelSummary(all, criteria) : null,
    };
  });

  return ok({
    sessions: sessions || [],
    session: { ...session, criteria },
    my_role: seat.role,
    meeting,
    panel_size: (panel || []).length,
    queue: out,
  });
}

// ── Save my own scores ─────────────────────────────────────────────────────
export async function POST(req) {
  const { member, res } = await requireMember(req); if (res) return res;
  const b = await readJson(req);
  const sb = supabaseAdmin();

  if (!b?.session_id || !b?.application_id) {
    return fail('INVALID', 400, { message: 'Missing candidate.' });
  }

  const { seat, error: seatErr } = await seatOf(sb, b.session_id, member.id);
  if (seatErr) {
    return fail('NOT_READY', 503, {
      message: 'Could not confirm you are on this panel, so nothing was saved.',
    });
  }
  if (!seat) {
    return fail('NOT_ON_PANEL', 403, {
      message: 'You are not on this interview panel, so your scores cannot be recorded.',
    });
  }

  const { data: session } = await sb.from('interview_sessions')
    .select('id, criteria, status').eq('id', b.session_id).maybeSingle();
  if (!session) return fail('NOT_FOUND', 404, { message: 'Interview session not found.' });
  if (session.status === 'closed') {
    return fail('CLOSED', 400, { message: 'This panel has been closed. Scores can no longer be changed.' });
  }

  // The candidate must be in THIS session's queue. Without this a panellist
  // could file a score against any application id they could guess.
  const { data: inQueue } = await sb.from('interview_queue')
    .select('id').eq('session_id', b.session_id).eq('application_id', b.application_id).maybeSingle();
  if (!inQueue) {
    return fail('NOT_IN_QUEUE', 400, { message: 'That candidate is not on this panel’s list.' });
  }

  const criteria = cleanCriteria(session.criteria);
  const { ok: valid, errors, value } = validateEvaluation(b, criteria);
  if (!valid) return fail('INVALID', 400, { message: 'Check your scores.', errors });

  /* Upsert keyed on the SIGNED TOKEN's member id.
   *
   * Never a panellist id from the body: that would let one office bearer file
   * scores under another's name, which is the single thing that would make
   * this record worthless if a candidate ever disputed the outcome. */
  const { data, error } = await sb.from('interview_evaluations')
    .upsert({
      session_id: b.session_id,
      application_id: b.application_id,
      panellist_member_id: member.id,
      scores: value.scores,
      notes: value.notes ?? null,
      recommendation: value.recommendation,
    }, { onConflict: 'session_id,application_id,panellist_member_id' })
    .select('*').maybeSingle();

  if (error) {
    return fail('WRITE_FAILED', 500, {
      message: 'Could not save your scores.', detail: error.message,
    });
  }

  return ok({ evaluation: data, message: 'Your scores are saved.' });
}
