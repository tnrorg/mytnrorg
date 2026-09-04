/* TNR Meetings — shared vocabulary and rules.
 *
 * Imported by the API routes, the admin tab and the member portal, so the
 * definition of "who may host", "is this live yet" and "can I press Join"
 * exists ONCE. The previous modules in this project learned that the hard
 * way: a status list duplicated between server and client drifts, and the
 * drift shows up as a button that is enabled but does nothing.
 *
 * Safe on the client — no secrets, no server-only imports.
 */

// ── Meeting types ──────────────────────────────────────────────────────────
export const MEETING_TYPES = [
  { key: 'general',    label: 'General Meeting',    icon: '🗓️' },
  { key: 'executive',  label: 'Executive Committee', icon: '🏛️' },
  { key: 'advisory',   label: 'Advisory Council',   icon: '🎓' },
  { key: 'department', label: 'Department Meeting', icon: '🧩' },
  { key: 'interview',  label: 'Interview',          icon: '🎤' },
  { key: 'training',   label: 'Training',           icon: '📚' },
  { key: 'workshop',   label: 'Workshop',           icon: '🛠️' },
  { key: 'special',    label: 'Special Meeting',    icon: '⭐' },
];
export const MEETING_TYPE_KEYS = MEETING_TYPES.map(t => t.key);
export const typeLabel = (k) => MEETING_TYPES.find(t => t.key === k)?.label || 'Meeting';
export const typeIcon = (k) => MEETING_TYPES.find(t => t.key === k)?.icon || '🗓️';

// ── Lifecycle ──────────────────────────────────────────────────────────────
export const STATUSES = ['scheduled', 'live', 'completed', 'cancelled'];
export const STATUS_LABEL = {
  scheduled: 'Upcoming', live: 'Live', completed: 'Completed', cancelled: 'Cancelled',
};
export const STATUS_TONE = {
  scheduled: { bg: 'rgba(11,107,79,.12)',  fg: '#0B6B4F' },
  live:      { bg: 'rgba(220,38,38,.12)',  fg: '#B91C1C' },
  completed: { bg: 'rgba(71,85,105,.12)',  fg: '#334155' },
  cancelled: { bg: 'rgba(120,113,108,.12)', fg: '#57534E' },
};

export const PARTICIPANT_ROLES = ['host', 'co_host', 'participant'];
export const INVITE_STATUSES = ['invited', 'accepted', 'declined', 'joined', 'missed'];

export const ATTENDANCE_STATUS = ['present', 'late', 'partial', 'absent'];
export const ATTENDANCE_TONE = {
  present: { bg: 'rgba(11,107,79,.12)',   fg: '#0B6B4F' },
  late:    { bg: 'rgba(217,119,6,.12)',   fg: '#B45309' },
  partial: { bg: 'rgba(202,138,4,.12)',   fg: '#A16207' },
  absent:  { bg: 'rgba(190,18,60,.10)',   fg: '#9F1239' },
};

/* Thresholds for turning a duration into a word.
 *
 * Exported rather than buried in the attendance writer so the report screen
 * can explain the rule to the person reading it. A percentage with no stated
 * cut-off invites an argument about whether 74% was "present". */
export const ATTENDANCE_RULES = {
  presentAtLeast: 75,   // % of the meeting's actual running time
  lateAfterMinutes: 10, // joined this long after the meeting started
};

// ── Group invite targets ───────────────────────────────────────────────────
/* The organisation has ROLES, Union Councils and areas — it has no
 * "departments". Rather than inventing a structure nobody maintains, the group
 * targets are the ones that already have real members behind them, so the
 * picker works on day one instead of after someone fills in a new table. */
export const AUDIENCE_KINDS = [
  { key: 'all',      label: 'All active members',        needsValue: false },
  { key: 'advisory', label: 'Advisory Council',          needsValue: false },
  { key: 'cec',      label: 'Central Executive Committee', needsValue: false },
  { key: 'uc_team',  label: 'Union Council Teams',       needsValue: false },
  { key: 'general',  label: 'General members',           needsValue: false },
  { key: 'uc',       label: 'A specific Union Council',  needsValue: true, valueLabel: 'Union Council' },
];
export const AUDIENCE_KEYS = AUDIENCE_KINDS.map(a => a.key);

// ── Validation ─────────────────────────────────────────────────────────────
export const TITLE_MAX = 160;
export const DURATION_MIN = 5;
export const DURATION_MAX = 720;

export function validateMeeting(b) {
  const e = {};
  const title = String(b.title || '').trim();
  if (!title) e.title = 'A title is required.';
  else if (title.length > TITLE_MAX) e.title = `Keep the title under ${TITLE_MAX} characters.`;

  if (!MEETING_TYPE_KEYS.includes(b.meeting_type)) e.meeting_type = 'Choose a meeting type.';

  const when = b.scheduled_at ? new Date(b.scheduled_at) : null;
  if (!when || Number.isNaN(when.getTime())) e.scheduled_at = 'Choose a date and time.';

  const dur = Number(b.duration_minutes);
  if (!Number.isFinite(dur) || dur < DURATION_MIN || dur > DURATION_MAX)
    e.duration_minutes = `Duration must be between ${DURATION_MIN} and ${DURATION_MAX} minutes.`;

  if (!b.host_id) e.host_id = 'Every meeting needs a host.';

  return { ok: Object.keys(e).length === 0, errors: e };
}

/* datetime-local <-> ISO.
 *
 * The same pair the news editor uses, and for the same reason: a
 * datetime-local input yields a NAIVE string with no zone, Postgres reads it
 * as UTC, and a meeting scheduled for 8pm in Pakistan is stored as 1am the
 * next day — invisible in "Upcoming" and wrong in every reminder. */
export function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
       + `T${p(d.getHours())}:${p(d.getMinutes())}`;
}
export function fromLocalInput(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/* ── Scheduling from a different country ──────────────────────────────────
 *
 * fromLocalInput reads a datetime-local value in the BROWSER's timezone. That
 * is right when the person scheduling sits in Roundu, and wrong the moment
 * they do not: an admin in Malaysia typing "11:00 PM" schedules 11pm Malaysia,
 * which is 8pm in Pakistan — the committee is told the wrong hour and nobody
 * notices until three of them join an empty room.
 *
 * The fix is not to guess. It is to make the admin SAY which clock they mean,
 * default it to the organisation's, and convert explicitly.
 */

/** The offset of `tz` at a given instant, in milliseconds. DST-correct. */
function tzOffsetMs(instant, tz) {
  const asTz = new Date(instant.toLocaleString('en-US', { timeZone: tz }));
  const asUtc = new Date(instant.toLocaleString('en-US', { timeZone: 'UTC' }));
  return asTz.getTime() - asUtc.getTime();
}

/**
 * A wall-clock string, read in a NAMED timezone, as a true instant.
 *
 * @param {string} local  "2026-09-04T23:00" from a datetime-local input
 * @param {string} tz     IANA zone the person meant, e.g. 'Asia/Karachi'
 */
export function zonedToUtc(local, tz) {
  if (!local) return null;
  const naive = new Date(`${local.length === 16 ? `${local}:00` : local}Z`);
  if (Number.isNaN(naive.getTime())) return null;

  /* Two passes. The offset depends on the instant, and the instant depends on
   * the offset — so the first pass gets close and the second lands exactly,
   * which matters on the two days a year a zone changes for DST. */
  let guess = new Date(naive.getTime() - tzOffsetMs(naive, tz));
  guess = new Date(naive.getTime() - tzOffsetMs(guess, tz));
  return guess.toISOString();
}

/** An instant back into a wall-clock string for a datetime-local input. */
export function utcToZonedInput(iso, tz) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(d);
  const g = (t) => f.find(x => x.type === t)?.value || '';
  return `${g('year')}-${g('month')}-${g('day')}T${p(g('hour') === '24' ? '00' : g('hour'))}:${g('minute')}`;
}

/** The browser's own zone, for showing an admin what they are about to do. */
export const browserTz = () => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || TNR_TZ; }
  catch { return TNR_TZ; }
};

/* Zones an admin abroad realistically schedules from. Any IANA zone works —
 * this is the shortlist that saves scrolling, not a limit. */
export const SCHEDULE_ZONES = [
  ['Asia/Karachi', 'Pakistan (TNR time)'],
  ['Asia/Kuala_Lumpur', 'Malaysia'],
  ['Asia/Dubai', 'UAE'],
  ['Asia/Riyadh', 'Saudi Arabia'],
  ['Asia/Qatar', 'Qatar'],
  ['Europe/London', 'United Kingdom'],
  ['America/New_York', 'US Eastern'],
  ['Australia/Sydney', 'Australia (Sydney)'],
];

// ── Derived lifecycle ──────────────────────────────────────────────────────
export const endsAt = (m) =>
  m?.scheduled_at ? new Date(new Date(m.scheduled_at).getTime() + (m.duration_minutes || 60) * 60000) : null;

/* What the meeting IS, as opposed to what the column last said.
 *
 * A meeting nobody remembered to close stays 'scheduled' in the database for
 * ever, and would sit at the top of Upcoming a month later. The stored column
 * is authoritative for the two states a human sets deliberately — cancelled,
 * and live once a host actually starts it — and time decides the rest.
 *
 * The database is still corrected by the lifecycle sweep on the server; this
 * is what makes the screen right in the meantime. */
export function effectiveStatus(m, now = Date.now()) {
  if (!m) return 'scheduled';
  if (m.status === 'cancelled' || m.status === 'completed') return m.status;

  const start = m.scheduled_at ? new Date(m.scheduled_at).getTime() : 0;
  const end = endsAt(m)?.getTime() || 0;

  if (m.status === 'live') {
    // A live meeting that has run an hour past its slot without anyone ending
    // it has almost certainly finished. Grace, not a hard cut.
    return now > end + 60 * 60000 ? 'completed' : 'live';
  }
  if (now > end) return 'completed';
  return 'scheduled';
}

/** Minutes until it starts. Negative once it has. */
export const minutesUntil = (m, now = Date.now()) =>
  m?.scheduled_at ? Math.round((new Date(m.scheduled_at).getTime() - now) / 60000) : Infinity;

// ── Which tab a member's meeting belongs in ────────────────────────────────
export const MEMBER_TABS = [
  { key: 'upcoming',  label: 'Upcoming' },
  { key: 'live',      label: 'Live' },
  { key: 'completed', label: 'Completed' },
  { key: 'missed',    label: 'Missed' },
  { key: 'cancelled', label: 'Cancelled' },
];

/* Missed is not a status — it is "the meeting finished and this member never
 * connected". Keeping it out of the status column means a meeting is not
 * simultaneously 'completed' for those who came and 'missed' for those who
 * did not; the answer depends on who is asking. */
export function tabFor(m, myParticipation) {
  const s = effectiveStatus(m);
  if (s === 'cancelled') return 'cancelled';
  if (s === 'live') return 'live';
  if (s === 'scheduled') return 'upcoming';
  return myParticipation?.joined_at ? 'completed' : 'missed';
}

// ── Can this member press Join? ────────────────────────────────────────────
/* One function, used by the button AND by the token endpoint.
 *
 * The button being disabled is a courtesy; the token endpoint calling the same
 * function is the control. If these two ever disagreed, the disagreement would
 * be in the direction of someone getting into a room they were refused.
 *
 * OPENS_BEFORE_MINUTES exists because people arrive early. Ten minutes is
 * enough to sort out a microphone without the room being open all afternoon.
 */
export const OPENS_BEFORE_MINUTES = 10;

export function joinability(m, { participation, isHost, isCoHost } = {}) {
  const no = (reason) => ({ can: false, reason });
  if (!m) return no('This meeting no longer exists.');

  const s = effectiveStatus(m);
  if (s === 'cancelled') return no('This meeting was cancelled.');
  if (s === 'completed') return no('This meeting has ended.');

  const host = !!isHost || !!isCoHost;
  if (!host && !participation) return no('You are not on the invitation list for this meeting.');
  if (!host && m.locked && s === 'live') return no('The host has locked this meeting.');

  const mins = minutesUntil(m);
  if (s === 'live') return { can: true, reason: '' };

  // Not started yet.
  if (host) {
    return mins > OPENS_BEFORE_MINUTES
      ? no(`You can start this meeting ${OPENS_BEFORE_MINUTES} minutes before it begins.`)
      : { can: true, reason: '', starting: true };
  }
  if (!m.join_before_host) return no('Waiting for the host to start the meeting.');
  return mins > OPENS_BEFORE_MINUTES
    ? no(`Opens ${OPENS_BEFORE_MINUTES} minutes before the start time.`)
    : { can: true, reason: '' };
}

// ── Who may schedule a meeting ─────────────────────────────────────────────
/* Derived from the role the ADMIN set at approval, never from anything the
 * member controls. A general member cannot schedule an Advisory Council
 * meeting and email 293 people about it.
 *
 * Admins holding the `meetings` scope reach this through the admin panel and
 * are authorised by lib/adminScopes.js instead — two doors, one rule each,
 * neither inferring authority from the browser. */
export const HOST_ROLES = ['cec', 'advisory'];
export function canCreateMeetings(member) {
  return !!member && HOST_ROLES.includes(String(member.role || '').trim());
}

/** The caller's capacity in one meeting. Read from the database, never sent up. */
export function roleInMeeting(meeting, memberId, participation) {
  if (!meeting || !memberId) return null;
  if (String(meeting.host_id) === String(memberId)) return 'host';
  if ((meeting.co_host_ids || []).map(String).includes(String(memberId))) return 'co_host';
  return participation ? (participation.role || 'participant') : null;
}
export const isHostLike = (r) => r === 'host' || r === 'co_host';

// ── Attendance ─────────────────────────────────────────────────────────────
/** Total seconds a meeting actually ran, for the percentage denominator. */
export function meetingRunSeconds(m) {
  if (m?.started_at && m?.ended_at) {
    const s = (new Date(m.ended_at) - new Date(m.started_at)) / 1000;
    if (s > 0) return Math.round(s);
  }
  return Math.max(1, (m?.duration_minutes || 60) * 60);
}

/* ABSENT MEANS NEVER CONNECTED. Nothing else.
 *
 * An earlier version of this had a second threshold below which a member was
 * recorded 'absent' — so someone who sat through 16 minutes of a 75-minute
 * session appeared in the report as not having attended. That is not a
 * borderline judgement, it is a false statement about a person, and these
 * records are what a committee uses to hold its members to account.
 *
 * Three honest categories: they never came, they came for part of it, or they
 * were there. The exact percentage is carried alongside, so anyone applying a
 * stricter rule for quorum can do so from the number rather than from a label
 * that has already thrown the information away.
 */
export function attendanceStatusFor({
  totalSeconds, runSeconds, firstJoinedAt, startedAt, scheduledAt,
}) {
  if (!(totalSeconds > 0)) return { status: 'absent', percentage: 0 };

  const pct = runSeconds > 0 ? (totalSeconds / runSeconds) * 100 : 0;
  const capped = Math.min(100, Math.round(pct * 100) / 100);

  if (capped < ATTENDANCE_RULES.presentAtLeast) return { status: 'partial', percentage: capped };

  /* Full attendance, but did they arrive on time?
   *
   * Measured from the LATER of the scheduled time and the actual start, and
   * both halves of that matter:
   *
   *   • A host who opens twenty minutes late must not make every attendee
   *     late — so the actual start counts.
   *   • A host who opens NINE MINUTES EARLY must not make a member who
   *     arrives exactly on time late either. That is what happened: the room
   *     opened at 10:51 for an 11:00 meeting, and everyone who came at 11:01
   *     was marked ten minutes late for being one minute late.
   *
   * Taking the later of the two is the only rule that is fair in both
   * directions. */
  const reference = [scheduledAt, startedAt].filter(Boolean).map(d => new Date(d).getTime());
  const from = reference.length ? Math.max(...reference) : null;
  const late = from && firstJoinedAt
    && (new Date(firstJoinedAt).getTime() - from) / 60000 > ATTENDANCE_RULES.lateAfterMinutes;

  return { status: late ? 'late' : 'present', percentage: capped };
}

// ── Display helpers ────────────────────────────────────────────────────────
/* THE ORGANISATION'S TIMEZONE.
 *
 * Every TNR member is in Pakistan, and a meeting time only ever means PKT. It
 * is configurable because that is one environment variable rather than a code
 * change if TNR ever runs a session for members abroad.
 */
export const TNR_TZ = process.env.NEXT_PUBLIC_TNR_TIMEZONE || 'Asia/Karachi';

/* A meeting time as a PERSON in Roundu reads it, wherever the code runs.
 *
 * fmtDateTime below uses the ambient timezone, which is right in a browser and
 * WRONG on the server: Vercel runs in UTC, so an email composed there rendered
 * 11:00 PM Pakistan time as the UTC clock face — a different number on a
 * different day. The member reads it, notes the wrong hour, and misses the
 * meeting.
 *
 * So anything generated on the server — emails, notification bodies, the .ics
 * summary — must use THIS, which pins the zone explicitly and labels it, so
 * there is no ambiguity even for a member reading in another country.
 */
export function fmtMeetingTime(iso, { tz = TNR_TZ, withZone = true } = {}) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';

  const text = d.toLocaleString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
    timeZone: tz,
  });

  if (!withZone) return text;

  /* The abbreviation from the runtime rather than a hard-coded "PKT", so a
   * different configured zone still labels itself correctly. */
  const zone = new Intl.DateTimeFormat('en-GB', { timeZone: tz, timeZoneName: 'short' })
    .formatToParts(d).find(p => p.type === 'timeZoneName')?.value || '';

  return zone ? `${text} (${zone})` : text;
}

export function fmtDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}
export function fmtDuration(seconds) {
  const s = Math.max(0, Math.round(seconds || 0));
  /* Round to whole MINUTES first, then split.
   *
   * Rounding the remainder separately produced "1h 60m" — 7199 seconds is
   * 1 hour and 59.98 minutes, which rounds to 60 and was printed beside the
   * hour instead of carrying into it. Anyone reading an attendance sheet and
   * seeing "1h 60m" stops trusting the rest of the column, and they are right
   * to. */
  const mins = Math.round(s / 60);
  const h = Math.floor(mins / 60), m = mins % 60;
  if (!h && !m) return '<1 min';
  return h ? `${h}h ${m}m` : `${m} min`;
}
/**
 * How long a member was ACTUALLY in the meeting.
 *
 * THE UNION OF THEIR SESSIONS, NOT THE SUM.
 *
 * This is the bug that put 7h 43m against a member of a two-hour meeting.
 * Sessions were simply added up, and they overlap constantly:
 *
 *   • a member opens the room on a phone and a laptop — two live sessions,
 *     the same minutes counted twice;
 *   • a connection drops and the browser reconnects before the old session is
 *     closed, so both run in parallel until the meeting ends;
 *   • the "close everything" sweep at the end of a meeting stamps the same
 *     end time on every session left open, and each one then claims the whole
 *     span since it began.
 *
 * Six sessions across a 1h47m window summed to nearly eight hours. The
 * percentage was capped at 100 so it LOOKED fine, which is why nobody caught
 * it until the duration column was read.
 *
 * Overlapping time is time in the meeting once. Merging the intervals is the
 * only correct answer, and it makes double-counting arithmetically impossible
 * rather than merely unlikely.
 *
 * @param {Array<{joined_at:string, left_at:?string}>} sessions
 * @param {{start:?string, end:?string}} window  the meeting's own bounds
 */
export function mergedAttendanceSeconds(sessions = [], window = {}) {
  const winStart = window.start ? new Date(window.start).getTime() : null;
  const winEnd = window.end ? new Date(window.end).getTime() : null;

  /* `= []` does NOT cover an explicit null, and Supabase hands back null on a
   * failed query. Without this guard a read error turned into a crash in the
   * attendance roll-up — the meeting would end and nobody's attendance would
   * be written at all. */
  const spans = [];
  for (const s of (Array.isArray(sessions) ? sessions : [])) {
    const a = s?.joined_at ? new Date(s.joined_at).getTime() : NaN;
    if (!Number.isFinite(a)) continue;

    /* An unclosed session ends when the MEETING ended.
     *
     * Previously these were dropped, so a member whose browser died in the
     * last minute lost that entire session. Bounded by the meeting's end, so
     * a session left open cannot run on for ever. With no known end — the
     * meeting is still live — it contributes nothing yet rather than counting
     * up to "now" and disagreeing with itself on every refresh. */
    let b = s?.left_at ? new Date(s.left_at).getTime() : (winEnd ?? NaN);
    if (!Number.isFinite(b)) continue;

    // Clamp into the meeting's own window: a stray session recorded before the
    // meeting started is not attendance at it.
    const from = winStart ? Math.max(a, winStart) : a;
    const to = winEnd ? Math.min(b, winEnd) : b;
    if (to > from) spans.push([from, to]);
  }

  if (!spans.length) return 0;
  spans.sort((x, y) => x[0] - y[0]);

  let total = 0;
  let [curFrom, curTo] = spans[0];
  for (let i = 1; i < spans.length; i += 1) {
    const [f, t] = spans[i];
    if (f <= curTo) curTo = Math.max(curTo, t);      // overlaps — extend, never add
    else { total += curTo - curFrom; [curFrom, curTo] = [f, t]; }
  }
  total += curTo - curFrom;
  return Math.round(total / 1000);
}

/** "in 2 hours" / "3 days ago" — a relative line reads faster than a date. */
export function relativeTime(iso) {
  if (!iso) return '';
  const diff = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(diff);
  const mins = Math.round(abs / 60000);
  const pick = mins < 60 ? [mins, 'minute']
    : mins < 1440 ? [Math.round(mins / 60), 'hour']
      : [Math.round(mins / 1440), 'day'];
  const [n, unit] = pick;
  const plural = n === 1 ? unit : `${unit}s`;
  return diff >= 0 ? `in ${n} ${plural}` : `${n} ${plural} ago`;
}

/* Fields safe to show about a participant inside a meeting.
 *
 * A meeting shows who is in the room — not a member's mobile number, address,
 * CNIC or date of birth. Naming the allowed columns here means an API route
 * cannot widen the list by accident with select('*'). */
export const PARTICIPANT_PUBLIC_FIELDS =
  'id, membership_id, full_name, photo_url, role';
