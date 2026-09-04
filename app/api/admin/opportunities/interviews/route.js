import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAdmin } from '@/lib/guard';
import { logAudit, clientIp } from '@/lib/audit';
import { ok, fail, readJson } from '@/lib/api';
import {
  cleanCriteria, validateEvaluation, panelSummary, QUEUE_STATES, POSITION_STEP,
  rankCandidates, coverage,
} from '@/lib/interviews';
import { newRoomId, inviteMembers } from '@/lib/meetingsServer';
import { sendInterviewEmail, INTERVIEW_EMAIL_CHUNK } from '@/lib/interviewEmail';

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

/* Panellists are MEMBERS, not admin accounts.
 *
 * The Executive Committee and the Advisory Council judge candidates; most of
 * them have no admin login. Seating admins would have meant handing office
 * bearers admin credentials just so they could score, which grants far more
 * than scoring. So an admin assembles the panel here, and the panellists score
 * from their own member portal.
 *
 * Never their contact details — a roster needs a name and a membership number. */
const PANEL_FIELDS = 'id, membership_id, full_name, photo_url, role, union_council';

/* Who may be seated.
 *
 * CEC and Advisory Council only. Not a hint in the UI — enforced on the
 * server, because "who is allowed to judge a fellowship" is a constitutional
 * question for the organisation, not a dropdown filter somebody can widen by
 * editing a request. */
export const PANEL_ROLES = ['cec', 'advisory'];

/** The roster for a session, with names resolved. */
async function panelOf(sb, sessionId) {
  const { data, error } = await sb.from('interview_panellists')
    .select('id, member_id, role').eq('session_id', sessionId);
  if (error) return { rows: [], error };

  const ids = (data || []).map(p => p.member_id);
  const people = new Map();
  if (ids.length) {
    const { data: members } = await sb.from('membership_members')
      .select(PANEL_FIELDS).in('id', ids);
    for (const m of members || []) people.set(m.id, m);
  }
  return {
    rows: (data || []).map(p => ({
      ...p,
      name: people.get(p.member_id)?.full_name || 'Panellist',
      membership_id: people.get(p.member_id)?.membership_id || null,
      member_role: people.get(p.member_id)?.role || null,
    })),
    error: null,
  };
}

export async function GET(req) {
  const { res } = await requireAdmin(req); if (res) return res;

  const sb = supabaseAdmin();
  const url = new URL(req.url);
  const sessionId = url.searchParams.get('session_id');
  const opportunityId = url.searchParams.get('opportunity_id');

  // Members who may be seated: active CEC and Advisory Council.
  if (url.searchParams.get('action') === 'panel_candidates') {
    const q = (url.searchParams.get('q') || '').trim();
    let sel = sb.from('membership_members').select(PANEL_FIELDS)
      .in('role', PANEL_ROLES)
      .eq('status', 'active').is('deleted_at', null)
      .order('full_name').limit(200);
    if (q) sel = sel.or(`full_name.ilike.%${q}%,membership_id.ilike.%${q}%`);
    const { data, error } = await sel;
    if (error) {
      return fail('READ_FAILED', 500, {
        message: 'Could not read the committee list.', detail: error.message,
      });
    }
    return ok({ members: data || [] });
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
  const panelIds = [...new Set((evals || []).map(e => e.panellist_member_id).filter(Boolean))];
  const panellists = new Map();
  if (panelIds.length) {
    const { data } = await sb.from('membership_members')
      .select('id, full_name, membership_id').in('id', panelIds);
    for (const m of data || []) panellists.set(m.id, m.full_name);
  }

  const byApp = new Map();
  for (const e of evals || []) {
    if (!byApp.has(e.application_id)) byApp.set(e.application_id, []);
    byApp.get(e.application_id).push({
      ...e, panellist_name: panellists.get(e.panellist_member_id) || 'Panellist',
    });
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

  /* NO 'evaluate' ACTION HERE, deliberately.
   *
   * Scoring belongs to the panel, and the panel is made of members. An admin
   * who is not a seated panellist has no business filing a judgement about a
   * candidate they did not interview — and one who IS a panellist scores from
   * their member portal like everybody else, so their score is attributed to
   * the person rather than to whichever admin account happened to be signed
   * in. See app/api/member/interviews/route.js. */
  if (b.action === 'state') return setState(sb, admin, b, req);
  if (b.action === 'panel') return setPanel(sb, admin, b, req);
  if (b.action === 'email') return sendEmails(sb, admin, b, req);

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
  /* Who will actually sit on the panel — resolved BEFORE the room is made,
   * because they have to go into it as co-hosts. */
  const wanted = [...new Set((b.panellist_ids || []).map(String).filter(Boolean))];
  let eligibleIds = [];
  let roleWarning = null;
  if (wanted.length) {
    const { data: eligible } = await sb.from('membership_members')
      .select('id').in('id', wanted)
      .in('role', PANEL_ROLES).eq('status', 'active').is('deleted_at', null);
    eligibleIds = (eligible || []).map(m => m.id);
    const refused = wanted.length - eligibleIds.length;
    if (refused) {
      roleWarning = `${refused} of the people chosen are not active CEC or `
        + 'Advisory Council members and were not seated.';
    }
  }

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
      /* THE PANEL ARE CO-HOSTS OF THE ROOM.
       *
       * Not a nicety. A co-host can admit from the waiting room, mute, and
       * remove — so if the chair's connection drops mid-morning, which on a
       * Gilgit-Baltistan link it will, another panellist can keep the day
       * running instead of thirty candidates sitting in a waiting room nobody
       * can open. */
      co_host_ids: eligibleIds.filter(id => id !== hostId),
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

    /* Everyone who needs to be in the room is invited to it.
     *
     * CANDIDATES as participants — invitation is not admission; they land in
     * the waiting area and are let in one at a time.
     *
     * PANELLISTS as co-hosts, and this is the part that was missing: a member
     * may only open a meeting if there is a row for them in
     * meeting_participants or they are host/co-host. Seating someone on the
     * panel without inviting them to the room would have produced a panellist
     * who could score a candidate they had no way of ever seeing. */
    const invited = await inviteMembers(meetingId,
      eligible.map(a => ({ id: a.member_id, via: 'interview' })), 'participant');
    if (!invited.added) meetingWarning = 'The room was created but no candidate could be invited to it.';

    const panelInvited = await inviteMembers(meetingId,
      eligibleIds.filter(id => id !== hostId).map(id => ({ id, via: 'panel', role: 'co_host' })),
      'co_host');
    if (eligibleIds.length > 1 && !panelInvited.added) {
      meetingWarning = [meetingWarning,
        'The panel could not be added to the room — they will not be able to join it.',
      ].filter(Boolean).join(' ');
    }
  }

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

  /* Seat the panel, checking the roles server-side.
   *
   * The ids arrive from a picker that already filters to CEC and Advisory, but
   * a request is not a picker. Re-reading the roles here is what actually
   * enforces "only the committee judges" — the filter in the UI is a
   * convenience, not the rule. */
  let panelWarning = roleWarning;
  // The host chairs by default: they run the room, and a session with a roster
  // but no chair leaves nobody able to close it.
  const seats = eligibleIds.map(id => ({
    session_id: session.id, member_id: id,
    role: id === String(b.host_id || '') ? 'chair' : 'panellist',
    added_by: admin.sub,
  }));

  if (seats.length) {
    const { error: pErr } = await sb.from('interview_panellists')
      .upsert(seats, { onConflict: 'session_id,member_id', ignoreDuplicates: true });
    if (pErr) {
      panelWarning = 'The panel roster could not be saved — run '
        + 'supabase/migration_interview_panel.sql. Until then nobody can score.';
    }
  } else if (!panelWarning) {
    panelWarning = 'No panellists were assigned yet — add them before the interviews start, '
      + 'or nobody will be able to record a score.';
  }

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
      .delete().eq('session_id', b.session_id).eq('member_id', b.member_id);
    if (error) return fail('WRITE_FAILED', 500, { message: 'Could not remove them.', detail: error.message });

    /* Take away their control of the ROOM as well as their seat.
     *
     * Leaving them as a co-host would let someone who is no longer on the
     * panel keep admitting candidates and muting people. Their participant row
     * stays, because they were genuinely in the meeting and the attendance
     * record should say so. */
    const { data: sess } = await sb.from('interview_sessions')
      .select('meeting_id').eq('id', b.session_id).maybeSingle();
    if (sess?.meeting_id) {
      const { data: meeting } = await sb.from('meetings')
        .select('co_host_ids').eq('id', sess.meeting_id).maybeSingle();
      if (meeting) {
        await sb.from('meetings')
          .update({ co_host_ids: (meeting.co_host_ids || []).filter(id => id !== b.member_id) })
          .eq('id', sess.meeting_id);
      }
      await sb.from('meeting_participants')
        .update({ role: 'participant' })
        .eq('meeting_id', sess.meeting_id).eq('member_id', b.member_id);
    }

    /* Their scores are NOT deleted with them.
     *
     * Someone taken off the roster after scoring twelve candidates still sat
     * in those interviews and formed those judgements. Erasing the scores
     * would quietly rewrite a record of what the panel actually thought. */
    await logAudit({
      action: 'INTERVIEW_PANEL_REMOVED', actor: admin?.username || 'admin',
      details: `${b.member_id} from session ${b.session_id}`, ip: clientIp(req),
    });
    return ok({ message: 'Removed from the panel. Any scores they already gave are kept.' });
  }

  const ids = [...new Set((b.member_ids || [b.member_id]).map(String).filter(Boolean))];
  if (!ids.length) return fail('INVALID', 400, { message: 'Choose who to add.' });

  // Same server-side role check as at creation. A panel is not somewhere a
  // general member can be quietly added by a hand-made request.
  const { data: eligible } = await sb.from('membership_members')
    .select('id').in('id', ids).in('role', PANEL_ROLES)
    .eq('status', 'active').is('deleted_at', null);
  const okIds = (eligible || []).map(m => m.id);
  if (!okIds.length) {
    return fail('NOT_ELIGIBLE', 400, {
      message: 'Only active Executive Committee and Advisory Council members can sit on a panel.',
    });
  }

  const { error } = await sb.from('interview_panellists').upsert(
    okIds.map(id => ({
      session_id: b.session_id, member_id: id,
      role: b.role === 'chair' ? 'chair' : 'panellist', added_by: admin.sub,
    })),
    { onConflict: 'session_id,member_id', ignoreDuplicates: true });

  /* And put them IN THE ROOM.
   *
   * Seating without inviting is the bug this whole change exists to fix: a
   * panellist added at 11am would be able to score candidates they had no way
   * of seeing, because a member can only open a meeting they are a participant
   * or co-host of. */
  let roomWarning = null;
  if (!error) {
    const { data: sess } = await sb.from('interview_sessions')
      .select('meeting_id').eq('id', b.session_id).maybeSingle();

    if (sess?.meeting_id) {
      await inviteMembers(sess.meeting_id,
        okIds.map(id => ({ id, via: 'panel', role: 'co_host' })), 'co_host');

      const { data: meeting } = await sb.from('meetings')
        .select('co_host_ids, host_id').eq('id', sess.meeting_id).maybeSingle();
      if (meeting) {
        const next = [...new Set([...(meeting.co_host_ids || []), ...okIds])]
          .filter(id => id !== meeting.host_id);
        const { error: cErr } = await sb.from('meetings')
          .update({ co_host_ids: next }).eq('id', sess.meeting_id);
        if (cErr) roomWarning = 'They were seated, but could not be made co-hosts of the room.';
      }
    } else {
      roomWarning = 'This session has no Virtual Hall room, so there is nowhere for them to join.';
    }
  }
  if (error) {
    return fail('WRITE_FAILED', 500, {
      message: 'Could not update the panel.', detail: error.message,
      hint: 'Administrator: run supabase/migration_interview_panel.sql.',
    });
  }

  await logAudit({
    action: 'INTERVIEW_PANEL_ADDED', actor: admin?.username || 'admin',
    details: `${okIds.length} to session ${b.session_id}`, ip: clientIp(req),
  });
  return ok({
    message: `${okIds.length} added to the panel and to the Virtual Hall room.`
      + (okIds.length < ids.length
        ? ` ${ids.length - okIds.length} were not eligible and were skipped.` : ''),
    warning: roomWarning || undefined,
  });
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

// ── Telling everyone ───────────────────────────────────────────────────────
/**
 * Email the candidates and the panel about an interview session.
 *
 * Chunked, and safe to press twice: whoever has already been emailed for this
 * meeting is skipped, using the same `invite_emailed_at` flag the meetings
 * module already keeps on meeting_participants. Reusing it rather than adding
 * a second tracking column means there is ONE answer to "has this person been
 * told about this meeting", instead of two that disagree.
 *
 * `resend: true` ignores the flag — which is what a reminder is.
 */
async function sendEmails(sb, admin, b, req) {
  if (!b.session_id) return fail('INVALID', 400, { message: 'Missing session.' });

  const { data: session } = await sb.from('interview_sessions')
    .select('id, title, meeting_id, opportunity_id').eq('id', b.session_id).maybeSingle();
  if (!session) return fail('NOT_FOUND', 404, { message: 'Interview session not found.' });
  if (!session.meeting_id) {
    return fail('NO_ROOM', 400, {
      message: 'This session has no Virtual Hall room, so there is nothing to invite anyone to.',
    });
  }

  const [{ data: meeting }, { data: opportunity }] = await Promise.all([
    sb.from('meetings').select('id, title, scheduled_at, duration_minutes')
      .eq('id', session.meeting_id).maybeSingle(),
    sb.from('opportunities').select('id, title').eq('id', session.opportunity_id).maybeSingle(),
  ]);

  /* Read the participant list, and SURVIVE invite_emailed_at not existing.
   *
   * Postgres rejects the whole select when one named column is missing, so
   * before migration_meetings_ai.sql has been run this returned nothing and the
   * route would have cheerfully reported "nobody to email". The same trap that
   * has taken down three other features in this codebase. */
  let rows = null;
  let tracking = true;

  const full = await sb.from('meeting_participants')
    .select('member_id, invite_emailed_at').eq('meeting_id', session.meeting_id)
    .order('created_at');

  if (full.error) {
    tracking = false;
    const plain = await sb.from('meeting_participants')
      .select('member_id').eq('meeting_id', session.meeting_id).order('created_at');
    if (plain.error) {
      return fail('READ_FAILED', 500, {
        message: 'Could not read who is on this interview.', detail: plain.error.message,
      });
    }
    rows = plain.data || [];
  } else {
    rows = full.data || [];
  }

  if (!rows.length) {
    return ok({ done: true, sent: 0, total: 0, message: 'Nobody is on this interview yet.' });
  }

  const reminder = !!b.reminder;
  const resend = reminder || !!b.resend;
  const pending = tracking ? rows.filter(r => resend || !r.invite_emailed_at) : rows;

  /* The flag is the cursor when it is doing the filtering — an offset ON TOP of
   * a shrinking list skips a batch every round. That bug sent 50 of 100
   * invitations and reported success; it is not being repeated here. */
  const useFlag = tracking && !resend;
  const from = useFlag ? 0 : (Number(b.offset) || 0);
  const slice = pending.slice(from, from + INTERVIEW_EMAIL_CHUNK);

  if (!slice.length) {
    return ok({
      done: true, sent: 0, total: pending.length,
      message: pending.length ? 'Everyone has already been emailed.' : 'Nobody left to email.',
    });
  }

  // Who is a panellist decides which letter they get.
  const { data: panel } = await sb.from('interview_panellists')
    .select('member_id').eq('session_id', b.session_id);
  const panelIds = new Set((panel || []).map(p => p.member_id));

  const { count: candidateCount } = await sb.from('interview_queue')
    .select('id', { count: 'exact', head: true }).eq('session_id', b.session_id);

  const { data: people } = await sb.from('membership_members')
    .select('id, full_name, email').in('id', slice.map(r => r.member_id));

  let sent = 0, failed = 0, noEmail = 0, lastError = null;
  for (const p of (people || [])) {
    const r = await sendInterviewEmail({
      kind: panelIds.has(p.id) ? 'panellist' : 'candidate',
      session, meeting, opportunity, member: p, reminder,
      extra: { candidateCount: candidateCount || 0 },
    });
    if (r.sent) {
      sent += 1;
      if (tracking) {
        await sb.from('meeting_participants')
          .update({ invite_emailed_at: new Date().toISOString() })
          .eq('meeting_id', session.meeting_id).eq('member_id', p.id);
      }
    } else if (r.skipped) noEmail += 1;
    else { failed += 1; lastError = lastError || r.error; }
  }

  const processed = from + slice.length;
  /* Stop when a round changes nothing. A member with no address, or one whose
   * send keeps failing, is never flagged and would otherwise be requested for
   * ever — a spinner that cannot end. */
  const done = useFlag
    ? (sent === 0 || pending.length <= slice.length)
    : processed >= pending.length;

  await logAudit({
    action: reminder ? 'INTERVIEW_REMINDER_SENT' : 'INTERVIEW_INVITES_SENT',
    actor: admin?.username || 'admin',
    details: `session ${b.session_id}: ${sent} sent, ${failed} failed, ${noEmail} without an address`,
    ip: clientIp(req),
  });

  return ok({
    sent, failed, no_email: noEmail,
    next_offset: useFlag ? 0 : processed,
    remaining: Math.max(0, pending.length - (useFlag ? sent : processed)),
    total: pending.length,
    done, tracking,
    detail: lastError || undefined,
    warning: tracking ? undefined
      : 'Run supabase/migration_meetings_ai.sql — without it nobody can be tracked, '
        + 'and pressing this again will email everyone a second time.',
  });
}
