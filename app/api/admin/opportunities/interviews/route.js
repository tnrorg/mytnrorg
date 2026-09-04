import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAdmin } from '@/lib/guard';
import { logAudit, clientIp } from '@/lib/audit';
import { ok, fail, readJson } from '@/lib/api';
import {
  cleanCriteria, validateEvaluation, panelSummary, QUEUE_STATES, POSITION_STEP,
  rankCandidates, coverage,
} from '@/lib/interviews';
import { newRoomId, inviteMembers } from '@/lib/meetingsServer';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 60;

const HINT = 'Administrator: run supabase/migration_interviews.sql.';

/* Interview panels in the TNR Virtual Hall.
 *
 * Nested under /api/admin/opportunities/, so it inherits the `opportunities`
 * permission area — the same people who read the applications run the
 * interviews, which is right, and no new scope is needed.
 *
 * THIS ROUTE NEVER CHANGES AN APPLICATION'S STATUS. That was the
 * organisation's decision: score all thirty, then decide. Every status change
 * still goes through the applications route, by hand, deliberately. If you are
 * reading this because a candidate was mysteriously rejected, it did not
 * happen here.
 *
 * There is no member-side counterpart to this file. A candidate has no
 * endpoint through which to read the queue, the scores, or the panel's notes —
 * not their own, and not anyone else's.
 */

const CANDIDATE_FIELDS = 'id, membership_id, full_name, photo_url, union_council';

/* Admin accounts, for picking the panel.
 *
 * Only a name and a username — never the password hash, the TOTP secret, or
 * the scope list. Listing admins is otherwise a super-admin-only action, and
 * this narrow read exists so an Opportunities holder can seat a panel without
 * being handed the whole Admin Accounts screen. */
const PANEL_FIELDS = 'id, username, full_name, role';

/** The roster, and whether the caller is on it. */
async function panelOf(sb, sessionId) {
  const { data, error } = await sb.from('interview_panellists')
    .select('id, admin_id, role').eq('session_id', sessionId);
  if (error) return { rows: [], error };

  const ids = (data || []).map(p => p.admin_id);
  const names = new Map();
  if (ids.length) {
    const { data: admins } = await sb.from('admin_users').select(PANEL_FIELDS).in('id', ids);
    for (const a of admins || []) names.set(a.id, a.full_name || a.username);
  }
  return {
    rows: (data || []).map(p => ({ ...p, name: names.get(p.admin_id) || 'Panellist' })),
    error: null,
  };
}

export async function GET(req) {
  const { res } = await requireAdmin(req); if (res) return res;

  const sb = supabaseAdmin();
  const url = new URL(req.url);
  const sessionId = url.searchParams.get('session_id');
  const opportunityId = url.searchParams.get('opportunity_id');

  // The list of admin accounts that can be seated on a panel.
  if (url.searchParams.get('action') === 'admins') {
    const { data, error } = await sb.from('admin_users').select(PANEL_FIELDS).order('full_name');
    if (error) return fail('READ_FAILED', 500, { message: 'Could not read admin accounts.' });
    return ok({ admins: data || [] });
  }

  // ── List sessions for an opportunity ─────────────────────────────────────
  if (!sessionId) {
    if (!opportunityId) return fail('INVALID', 400, { message: 'Missing opportunity.' });
    const { data, error } = await sb.from('interview_sessions')
      .select('*').eq('opportunity_id', opportunityId).order('created_at', { ascending: false });
    if (error) {
      return fail('READ_FAILED', 500, {
        message: 'Could not read interview sessions.', detail: error.message, hint: HINT,
      });
    }
    return ok({ sessions: data || [] });
  }

  // ── One session: the queue, the applications, the scores ─────────────────
  const { data: session, error: sErr } = await sb.from('interview_sessions')
    .select('*').eq('id', sessionId).maybeSingle();
  if (sErr) {
    return fail('READ_FAILED', 500, { message: 'Could not read the session.', detail: sErr.message, hint: HINT });
  }
  if (!session) return fail('NOT_FOUND', 404, { message: 'Interview session not found.' });

  const { data: queue, error: qErr } = await sb.from('interview_queue')
    .select('*').eq('session_id', sessionId).order('position');
  if (qErr) {
    return fail('READ_FAILED', 500, { message: 'Could not read the queue.', detail: qErr.message });
  }

  const appIds = (queue || []).map(q => q.application_id);
  const memberIds = (queue || []).map(q => q.member_id);

  // The applications, so the panel can read what the candidate wrote while
  // they are in the room rather than opening a second screen.
  const apps = new Map();
  for (let i = 0; i < appIds.length; i += 100) {
    const { data } = await sb.from('opportunity_applications')
      .select('id, status, answers, profile_gaps, created_at')
      .in('id', appIds.slice(i, i + 100));
    for (const a of data || []) apps.set(a.id, a);
  }

  const members = new Map();
  for (let i = 0; i < memberIds.length; i += 100) {
    const { data } = await sb.from('membership_members')
      .select(CANDIDATE_FIELDS).in('id', memberIds.slice(i, i + 100));
    for (const m of data || []) members.set(m.id, m);
  }

  const { data: evals } = await sb.from('interview_evaluations')
    .select('*').eq('session_id', sessionId);

  // Panellist names, so a score reads as "Zahid gave 7" rather than a uuid.
  const panelIds = [...new Set((evals || []).map(e => e.panellist_id))];
  const panellists = new Map();
  if (panelIds.length) {
    const { data } = await sb.from('admin_users')
      .select('id, username, full_name').in('id', panelIds);
    for (const a of data || []) panellists.set(a.id, a.full_name || a.username);
  }

  const byApp = new Map();
  for (const e of evals || []) {
    if (!byApp.has(e.application_id)) byApp.set(e.application_id, []);
    byApp.get(e.application_id).push({ ...e, panellist_name: panellists.get(e.panellist_id) || 'Panellist' });
  }

  const criteria = cleanCriteria(session.criteria);
  const rows = (queue || []).map(q => {
    const mine = byApp.get(q.application_id) || [];
    return {
      ...q,
      application: apps.get(q.application_id) || null,
      candidate: members.get(q.member_id) || null,
      evaluations: mine,
      summary: panelSummary(mine, criteria),
    };
  });

  let meeting = null;
  if (session.meeting_id) {
    const { data } = await sb.from('meetings')
      .select('id, title, status, scheduled_at, waiting_room_enabled, room_id')
      .eq('id', session.meeting_id).maybeSingle();
    meeting = data || null;
  }

  const panel = await panelOf(sb, sessionId);

  /* The matched, ranked result — computed here so the console and any future
   * export cannot produce two different shortlists from the same scores. */
  const { ranked, unranked } = rankCandidates(rows, criteria);

  return ok({
    session: { ...session, criteria },
    meeting,
    queue: rows,
    panel: panel.rows,
    panel_missing: !!panel.error,
    results: { ranked, unranked, coverage: coverage(rows, panel.rows.length) },
  });
}

// ── Create a session, with its room and its queue ──────────────────────────
export async function POST(req) {
  const { admin, res } = await requireAdmin(req); if (res) return res;
  const b = await readJson(req);
  const sb = supabaseAdmin();

  if (b.action === 'evaluate') return saveEvaluation(sb, admin, b, req);
  if (b.action === 'state') return setState(sb, admin, b, req);
  if (b.action === 'panel') return setPanel(sb, admin, b, req);

  // ── action: create ───────────────────────────────────────────────────────
  const opportunityId = String(b.opportunity_id || '').trim();
  const applicationIds = [...new Set((b.application_ids || []).map(String).filter(Boolean))];
  if (!opportunityId) return fail('INVALID', 400, { message: 'Missing opportunity.' });
  if (!applicationIds.length) return fail('INVALID', 400, { message: 'Choose at least one candidate.' });

  const { data: opp } = await sb.from('opportunities')
    .select('id, title').eq('id', opportunityId).maybeSingle();
  if (!opp) return fail('NOT_FOUND', 404, { message: 'Opportunity not found.' });

  /* Read the applications back rather than trusting the ids sent.
   *
   * The console sends what is on screen. If a candidate was withdrawn or
   * rejected between the page loading and the button being pressed, they must
   * not be put in the queue — they would sit in a waiting room for an
   * interview nobody intends to give them. */
  const { data: apps, error: aErr } = await sb.from('opportunity_applications')
    .select('id, member_id, status')
    .eq('opportunity_id', opportunityId)
    .in('id', applicationIds);
  if (aErr) {
    return fail('READ_FAILED', 500, { message: 'Could not read the applications.', detail: aErr.message });
  }

  const eligible = (apps || []).filter(a => !['withdrawn', 'rejected'].includes(a.status));
  if (!eligible.length) {
    return fail('INVALID', 400, {
      message: 'None of those candidates can be interviewed — they are withdrawn or already rejected.',
    });
  }

  const criteria = cleanCriteria(b.criteria);
  const title = String(b.title || `${opp.title} — interviews`).trim().slice(0, 160);

  /* The room.
   *
   * waiting_room_enabled is forced TRUE and is not taken from the request.
   * The entire format depends on it: without a waiting room, all thirty
   * candidates walk into the panel's meeting at once and hear each other's
   * interviews. That is not a setting to leave to a checkbox somebody might
   * untick.
   *
   * join_before_host is forced FALSE for the same reason. */
  let meetingId = null;
  let meetingWarning = null;

  if (b.create_meeting !== false) {
    const hostId = String(b.host_id || '').trim();
    if (!hostId) return fail('INVALID', 400, { message: 'Choose who chairs the panel.' });

    const { data: meeting, error: mErr } = await sb.from('meetings').insert({
      title,
      description: `Interview panel for ${opp.title}. Candidates are admitted one at a time from the waiting room.`,
      meeting_type: 'general',
      scheduled_at: b.scheduled_at || new Date().toISOString(),
      duration_minutes: Math.min(600, Math.max(30, Number(b.duration_minutes) || 240)),
      host_id: hostId,
      room_id: newRoomId(),
      status: 'scheduled',
      waiting_room_enabled: true,
      join_before_host: false,
      chat_enabled: true,
      screen_share_enabled: true,
      recording_enabled: !!b.recording_enabled,
    }).select('id').maybeSingle();

    if (mErr) {
      return fail('WRITE_FAILED', 500, {
        message: 'Could not create the interview room.', detail: mErr.message,
        hint: 'Administrator: run supabase/migration_meetings.sql.',
      });
    }
    meetingId = meeting.id;

    // Candidates are invited to the meeting so they can reach the waiting
    // room from their own portal. Invitation ≠ admission.
    const invited = await inviteMembers(meetingId,
      eligible.map(a => ({ id: a.member_id, via: 'interview' })), 'participant');
    if (!invited.added) meetingWarning = 'The room was created but nobody could be invited to it.';
  }

  const panelIds = [...new Set((b.panellist_ids || []).map(String).filter(Boolean))];

  const { data: session, error: sErr } = await sb.from('interview_sessions').insert({
    opportunity_id: opportunityId,
    meeting_id: meetingId,
    title, criteria, status: 'open',
    created_by: admin?.sub || null,
  }).select('*').maybeSingle();

  if (sErr) {
    return fail('WRITE_FAILED', 500, {
      message: 'Could not create the interview session.', detail: sErr.message, hint: HINT,
    });
  }

  /* Queue order: as sent by the console.
   *
   * Sparse positions (10, 20, 30…) so one candidate can later be moved
   * between two others without renumbering every row. */
  const order = applicationIds.filter(id => eligible.some(a => a.id === id));
  const rows = order.map((id, i) => ({
    session_id: session.id,
    application_id: id,
    member_id: eligible.find(a => a.id === id).member_id,
    position: (i + 1) * POSITION_STEP,
    state: 'waiting',
  }));

  const { error: qErr } = await sb.from('interview_queue')
    .upsert(rows, { onConflict: 'session_id,application_id', ignoreDuplicates: true });
  if (qErr) {
    return fail('WRITE_FAILED', 500, {
      message: 'The session was created but the queue could not be filled.', detail: qErr.message,
    });
  }

  /* Seat the panel.
   *
   * The creating admin is always on it, as chair. Without that, an office
   * bearer who forgets to add themselves creates a session they are then
   * refused permission to score in — and the refusal would arrive mid-panel,
   * with a candidate sitting in the room. */
  const seats = [
    { session_id: session.id, admin_id: admin.sub, role: 'chair', added_by: admin.sub },
    ...panelIds.filter(id => id !== admin.sub).map(id => ({
      session_id: session.id, admin_id: id, role: 'panellist', added_by: admin.sub,
    })),
  ];
  const { error: pErr } = await sb.from('interview_panellists')
    .upsert(seats, { onConflict: 'session_id,admin_id', ignoreDuplicates: true });
  const panelWarning = pErr
    ? 'The panel roster could not be saved — run supabase/migration_interview_panel.sql.'
    : null;

  await logAudit({
    action: 'INTERVIEW_SESSION_CREATED', actor: admin?.username || 'admin',
    details: `${title} — ${rows.length} candidate(s)${meetingId ? ', room created' : ''}`,
    ip: clientIp(req),
  });

  const skipped = applicationIds.length - rows.length;
  return ok({
    session, meeting_id: meetingId,
    queued: rows.length,
    message: `Interview session ready with ${rows.length} candidate(s).`
      + (skipped ? ` ${skipped} were left out as withdrawn or rejected.` : ''),
    warning: [meetingWarning, panelWarning].filter(Boolean).join(' ') || undefined,
  });
}

// ── Who sits on the panel ──────────────────────────────────────────────────
async function setPanel(sb, admin, b, req) {
  if (!b.session_id) return fail('INVALID', 400, { message: 'Missing session.' });

  if (b.remove) {
    /* The last seat cannot be removed.
     *
     * An empty roster means nobody may score, and — worse — the coverage
     * figure becomes "3 of 0", which reads as complete. A panel of nobody is
     * not a state this should be able to reach by clicking Remove twice. */
    const { data: current } = await sb.from('interview_panellists')
      .select('id').eq('session_id', b.session_id);
    if ((current || []).length <= 1) {
      return fail('INVALID', 400, { message: 'A panel needs at least one member.' });
    }
    const { error } = await sb.from('interview_panellists')
      .delete().eq('session_id', b.session_id).eq('admin_id', b.admin_id);
    if (error) return fail('WRITE_FAILED', 500, { message: 'Could not remove them.', detail: error.message });

    /* Their scores are NOT deleted with them.
     *
     * Someone taken off the roster after scoring twelve candidates still sat
     * in those interviews and formed those judgements. Erasing the scores
     * would quietly rewrite a record of what the panel actually thought. */
    await logAudit({
      action: 'INTERVIEW_PANEL_REMOVED', actor: admin?.username || 'admin',
      details: `${b.admin_id} from session ${b.session_id}`, ip: clientIp(req),
    });
    return ok({ message: 'Removed from the panel. Any scores they already gave are kept.' });
  }

  const ids = [...new Set((b.admin_ids || [b.admin_id]).map(String).filter(Boolean))];
  if (!ids.length) return fail('INVALID', 400, { message: 'Choose who to add.' });

  const { error } = await sb.from('interview_panellists').upsert(
    ids.map(id => ({
      session_id: b.session_id, admin_id: id,
      role: b.role === 'chair' ? 'chair' : 'panellist', added_by: admin.sub,
    })),
    { onConflict: 'session_id,admin_id', ignoreDuplicates: true });
  if (error) {
    return fail('WRITE_FAILED', 500, {
      message: 'Could not update the panel.', detail: error.message,
      hint: 'Administrator: run supabase/migration_interview_panel.sql.',
    });
  }

  await logAudit({
    action: 'INTERVIEW_PANEL_ADDED', actor: admin?.username || 'admin',
    details: `${ids.length} to session ${b.session_id}`, ip: clientIp(req),
  });
  return ok({ message: `${ids.length} added to the panel.` });
}

// ── One panellist's evaluation of one candidate ────────────────────────────
async function saveEvaluation(sb, admin, b, req) {
  if (!b.session_id || !b.application_id) {
    return fail('INVALID', 400, { message: 'Missing candidate.' });
  }
  if (!admin?.sub) {
    return fail('INVALID', 400, { message: 'Could not identify you as a panellist. Sign in again.' });
  }

  const { data: session } = await sb.from('interview_sessions')
    .select('id, criteria, status').eq('id', b.session_id).maybeSingle();
  if (!session) return fail('NOT_FOUND', 404, { message: 'Interview session not found.' });
  if (session.status === 'closed') {
    return fail('CLOSED', 400, { message: 'This interview session has been closed.' });
  }

  /* ONLY THE PANEL MAY SCORE.
   *
   * Holding the Opportunities permission makes you able to read applications;
   * it does not make you a member of this panel. Without this check any of
   * those admins could file a score, and "3 of 4 panellists have scored" would
   * be counted against a 4 that does not describe anybody.
   *
   * A missing roster table (migration not yet run) is treated as "not seated"
   * and says so, rather than silently letting everyone through — failing open
   * on a permission check is how a permission check becomes decoration. */
  const seat = await sb.from('interview_panellists')
    .select('id').eq('session_id', b.session_id).eq('admin_id', admin.sub).maybeSingle();

  if (seat.error) {
    return fail('PANEL_UNAVAILABLE', 500, {
      message: 'Could not confirm you are on this panel, so the score was not saved.',
      hint: 'Administrator: run supabase/migration_interview_panel.sql.',
    });
  }
  if (!seat.data) {
    return fail('NOT_ON_PANEL', 403, {
      message: 'You are not on this interview panel, so your scores cannot be recorded. '
        + 'Ask the chair to add you.',
    });
  }

  const criteria = cleanCriteria(session.criteria);
  const { ok: valid, errors, value } = validateEvaluation(b, criteria);
  if (!valid) return fail('INVALID', 400, { message: 'Check the scores.', errors });

  /* Upsert on (session, application, panellist).
   *
   * The panellist is taken from the SIGNED TOKEN, never from the request body.
   * A panellist_id in the body would let one office bearer file scores under
   * another's name, which is the one thing that would make this record
   * worthless in a dispute. */
  const row = {
    session_id: b.session_id,
    application_id: b.application_id,
    panellist_id: admin.sub,
    scores: value.scores,
    notes: value.notes ?? null,
    recommendation: value.recommendation,
  };

  const { data, error } = await sb.from('interview_evaluations')
    .upsert(row, { onConflict: 'session_id,application_id,panellist_id' })
    .select('*').maybeSingle();

  if (error) {
    return fail('WRITE_FAILED', 500, { message: 'Could not save your scores.', detail: error.message, hint: HINT });
  }

  await logAudit({
    action: 'INTERVIEW_SCORED', actor: admin?.username || 'admin',
    details: `application ${b.application_id} in session ${b.session_id}`,
    ip: clientIp(req),
  });

  return ok({ evaluation: data, message: 'Your scores are saved.' });
}

// ── Moving a candidate through the queue ───────────────────────────────────
async function setState(sb, admin, b, req) {
  if (!b.queue_id || !QUEUE_STATES.includes(b.state)) {
    return fail('INVALID', 400, { message: 'Unknown queue state.' });
  }

  const patch = { state: b.state };
  const now = new Date().toISOString();

  /* Timestamps are set by the SERVER, from the state change.
   *
   * "started_at" is when the panel said the candidate came in, not a time the
   * browser reported — a clock that is wrong on one laptop would otherwise put
   * a five-minute interview at forty minutes in the record. */
  if (b.state === 'in_progress') { patch.started_at = now; patch.ended_at = null; }
  if (['done', 'no_show'].includes(b.state)) patch.ended_at = now;

  /* Only ONE candidate can be in the room at a time.
   *
   * Calling the next person while the previous is still marked in_progress is
   * the most likely mistake in a four-hour panel, and it would leave two
   * interviews overlapping in the record with no way to tell which notes
   * belong to whom. Everyone else in progress is closed off first. */
  if (b.state === 'in_progress' && b.session_id) {
    await sb.from('interview_queue')
      .update({ state: 'done', ended_at: now })
      .eq('session_id', b.session_id).eq('state', 'in_progress').neq('id', b.queue_id);
  }

  const { data, error } = await sb.from('interview_queue')
    .update(patch).eq('id', b.queue_id).select('*').maybeSingle();
  if (error) return fail('WRITE_FAILED', 500, { message: 'Could not update the queue.', detail: error.message });
  if (!data) return fail('NOT_FOUND', 404, { message: 'That candidate is no longer in the queue.' });

  await logAudit({
    action: 'INTERVIEW_QUEUE_STATE', actor: admin?.username || 'admin',
    details: `${b.queue_id} → ${b.state}`, ip: clientIp(req),
  });

  return ok({ row: data });
}

// ── Close a session ────────────────────────────────────────────────────────
export async function PATCH(req) {
  const { admin, res } = await requireAdmin(req); if (res) return res;
  const b = await readJson(req);
  if (!b?.id) return fail('INVALID', 400, { message: 'Missing session.' });

  const sb = supabaseAdmin();
  const patch = {};
  if (b.status && ['open', 'closed'].includes(b.status)) patch.status = b.status;
  if (b.criteria) patch.criteria = cleanCriteria(b.criteria);
  if (b.title) patch.title = String(b.title).trim().slice(0, 160);
  if (!Object.keys(patch).length) return fail('INVALID', 400, { message: 'Nothing to change.' });

  const { data, error } = await sb.from('interview_sessions')
    .update(patch).eq('id', b.id).select('*').maybeSingle();
  if (error) return fail('WRITE_FAILED', 500, { message: 'Could not update.', detail: error.message });
  if (!data) return fail('NOT_FOUND', 404, { message: 'Session not found.' });

  await logAudit({
    action: 'INTERVIEW_SESSION_UPDATED', actor: admin?.username || 'admin',
    details: `${b.id}: ${Object.keys(patch).join(', ')}`, ip: clientIp(req),
  });
  return ok({ session: data, message: patch.status === 'closed' ? 'Session closed.' : 'Updated.' });
}
