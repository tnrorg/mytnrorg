/* TNR contribution tracking — the shared vocabulary.
 *
 * Imported by the admin tab, the member page and both API routes, so all four
 * describe a member's participation with the same words and the same rules.
 * No 'server-only' here: the browser needs the labels.
 *
 * TWO DECISIONS MADE BY THE ORGANISATION, WRITTEN DOWN SO CODE CANNOT DRIFT
 * FROM THEM:
 *
 *   1. COUNTS, NOT A SCORE. There is no points total and no rank. A volunteer
 *      organisation that publishes a league table of its volunteers teaches
 *      the people at the bottom that they are failing, and the people at the
 *      top to optimise for whatever is being counted. So the tracker reports
 *      "8 of 11 meetings attended, 3 opinions, 12 hours logged" and lets a
 *      human read it.
 *
 *   2. VISIBLE TO THE MEMBER AND TO LEADERSHIP, NOBODY ELSE. A member sees
 *      their own record. Office bearers with the analytics permission see
 *      everyone's. No member can look up another member, and none of it is
 *      public. Enforced in the routes, not here.
 */

// ── The calendar year ──────────────────────────────────────────────────────
/* Jan–Dec, matching the annual report and the election cycle.
 *
 * TNR_TZ, not the server's clock. A meeting at 11 pm on 31 December in Roundu
 * is 6 pm UTC the same day, but one at 2 am on 1 January is 9 pm on 31
 * December UTC — so a UTC year boundary moves January's activity into the
 * previous year's report. The organisation's year ends when it ends in Roundu.
 */
export const TNR_TZ = process.env.NEXT_PUBLIC_TNR_TIMEZONE || 'Asia/Karachi';

/** Milliseconds to add to a UTC instant to read it as wall-clock time in `tz`. */
function tzOffsetMs(instant, tz) {
  const asTz = new Date(instant.toLocaleString('en-US', { timeZone: tz }));
  const asUtc = new Date(instant.toLocaleString('en-US', { timeZone: 'UTC' }));
  return asTz.getTime() - asUtc.getTime();
}

/** The UTC instant at which a wall-clock time in `tz` occurs. */
function zonedToUtc(localIso, tz) {
  const naive = new Date(`${localIso}Z`);
  if (Number.isNaN(naive.getTime())) return null;
  let guess = new Date(naive.getTime() - tzOffsetMs(naive, tz));
  guess = new Date(naive.getTime() - tzOffsetMs(guess, tz));
  return guess;
}

/**
 * The half-open bounds of a calendar year, as UTC instants.
 *
 * Half-open — `from <= t < to` — so a meeting at exactly midnight on 1 January
 * belongs to the new year and to nothing else. Inclusive-both-ends bounds put
 * that one instant in two years and double-count it.
 *
 * @returns {{ year:number, from:string, to:string, fromDate:string, toDate:string }}
 *   `from`/`to` are ISO instants for timestamptz columns; `fromDate`/`toDate`
 *   are plain YYYY-MM-DD for `date` columns, which have no timezone at all and
 *   must not be compared against an instant.
 */
export function yearBounds(year, tz = TNR_TZ) {
  const y = Number(year) || new Date().getFullYear();
  const from = zonedToUtc(`${y}-01-01T00:00:00`, tz);
  const to = zonedToUtc(`${y + 1}-01-01T00:00:00`, tz);
  return {
    year: y,
    from: from.toISOString(),
    to: to.toISOString(),
    fromDate: `${y}-01-01`,
    toDate: `${y}-12-31`,      // inclusive: `date` columns use .lte(toDate)
  };
}

/** Years offered in the selector: the current one back to when TNR went online. */
export function availableYears(firstYear = 2024) {
  const now = new Date().getFullYear();
  const out = [];
  for (let y = now; y >= firstYear; y -= 1) out.push(y);
  return out;
}

// ── What can be logged by hand ─────────────────────────────────────────────
/* The work the platform cannot see.
 *
 * Everything else in the tracker is derived from records the platform already
 * holds. These are the categories an office bearer types in afterwards, and
 * they are deliberately concrete: "Community service" would be filled in for
 * everything, which tells nobody anything.
 */
export const ACTIVITY_TYPES = [
  { key: 'field_activity',  label: 'Field activity',        icon: '🌱',
    hint: 'Cleanliness drive, tree planting, awareness walk, camp' },
  { key: 'event_organised', label: 'Organised an event',    icon: '📅',
    hint: 'Planned or ran a TNR programme, seminar or ceremony' },
  { key: 'relief_work',     label: 'Relief & welfare',      icon: '🤲',
    hint: 'Distribution, emergency response, support to a family' },
  { key: 'education',       label: 'Education & teaching',  icon: '📚',
    hint: 'Tutoring, school visit, career counselling session' },
  { key: 'representation',  label: 'Represented TNR',       icon: '🎤',
    hint: 'Spoke for TNR at an external meeting, forum or media' },
  { key: 'committee_work',  label: 'Committee work',        icon: '🗂️',
    hint: 'Office-bearer duty carried out away from the platform' },
  { key: 'fundraising',     label: 'Fundraising',           icon: '💰',
    hint: 'Raised or coordinated funds for a TNR activity' },
  { key: 'other',           label: 'Other contribution',    icon: '⭐',
    hint: 'Anything genuine that does not fit the categories above' },
];

export const ACTIVITY_TYPE_KEYS = ACTIVITY_TYPES.map(a => a.key);
export const activityLabel = (k) =>
  ACTIVITY_TYPES.find(a => a.key === k)?.label || 'Contribution';
export const activityIcon = (k) =>
  ACTIVITY_TYPES.find(a => a.key === k)?.icon || '⭐';

// ── The six things being counted ───────────────────────────────────────────
/* Used to render the same six groups, in the same order, with the same
 * wording, on the admin table, the member's profile and their own page.
 *
 * All six are things a member DOES for TNR. Events and volunteering were
 * already recorded by the platform before this module existed and were missing
 * from the first version of the tracker — which meant a member whose whole
 * contribution was volunteering appeared to have done nothing at all. */
export const SOURCES = [
  { key: 'meetings',     label: 'Meetings',    icon: '🎥',
    hint: 'Sessions attended, out of those you were invited to' },
  { key: 'events',       label: 'Events',      icon: '📅',
    hint: 'TNR programmes and events you took part in' },
  { key: 'volunteering', label: 'Volunteering', icon: '🤝',
    hint: 'Volunteer assignments taken on, and hours served' },
  { key: 'writing',      label: 'Writing',     icon: '✍️',
    hint: 'Opinions published, and comments in discussions' },
  { key: 'activities',   label: 'Field work',  icon: '🌱',
    hint: 'Activity in Roundu, recorded by an office bearer' },
  { key: 'leadership',   label: 'Leadership',  icon: '🏅',
    hint: 'Meetings hosted, and duties carried as an office bearer' },
];

// ── Validation ─────────────────────────────────────────────────────────────
const MAX_TITLE = 160;
const MAX_DESC = 2000;

/**
 * Check a manual activity before it is written.
 *
 * @returns {{ ok:boolean, errors:Object, value:Object }}
 */
export function validateActivity(input = {}, { editing = false } = {}) {
  const errors = {};
  const v = {};

  if (!editing || input.member_id !== undefined) {
    v.member_id = String(input.member_id || '').trim();
    if (!v.member_id) errors.member_id = 'Choose the member this belongs to.';
  }

  if (!editing || input.activity_type !== undefined) {
    v.activity_type = String(input.activity_type || '').trim();
    if (!ACTIVITY_TYPE_KEYS.includes(v.activity_type)) {
      errors.activity_type = 'Choose what kind of activity this was.';
    }
  }

  if (!editing || input.title !== undefined) {
    v.title = String(input.title || '').trim();
    if (v.title.length < 3) errors.title = 'Give it a short title.';
    else if (v.title.length > MAX_TITLE) errors.title = `Keep the title under ${MAX_TITLE} characters.`;
  }

  if (input.description !== undefined) {
    v.description = String(input.description || '').trim().slice(0, MAX_DESC) || null;
  }

  if (!editing || input.activity_date !== undefined) {
    const d = String(input.activity_date || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      errors.activity_date = 'Give the date it happened.';
    } else {
      /* No future dates.
       *
       * The tracker is a record of what has been done. A date in the future is
       * either a typo or a plan, and a plan recorded as a contribution is the
       * point at which the whole tracker stops being trustworthy. Compared in
       * TNR time, so an office bearer logging today's work late at night is not
       * told their date is in the future. */
      const today = new Date().toLocaleDateString('en-CA', { timeZone: TNR_TZ });
      if (d > today) errors.activity_date = 'That date has not happened yet.';
      else v.activity_date = d;
    }
  }

  if (input.hours !== undefined && input.hours !== null && input.hours !== '') {
    const h = Number(input.hours);
    if (!Number.isFinite(h) || h < 0 || h > 24) {
      errors.hours = 'Hours must be between 0 and 24.';
    } else {
      v.hours = Math.round(h * 100) / 100;
    }
  } else if (input.hours !== undefined) {
    v.hours = null;
  }

  if (input.location !== undefined) {
    v.location = String(input.location || '').trim().slice(0, 160) || null;
  }
  if (input.evidence_url !== undefined) {
    const u = String(input.evidence_url || '').trim();
    // Only http(s). A javascript: or data: URL here would be rendered as a
    // link on the member's own page and on the admin drill-down.
    v.evidence_url = /^https?:\/\//i.test(u) ? u.slice(0, 500) : null;
  }

  return { ok: Object.keys(errors).length === 0, errors, value: v };
}

// ── Shaping a member's year ────────────────────────────────────────────────
/**
 * The empty record. Every member starts here, so a member with no activity is
 * a row of honest zeros rather than a missing row that the UI has to guess at.
 */
export const emptyRecord = () => ({
  meetings: { invited: 0, attended: 0, partial: 0, late: 0, absent: 0, minutes: 0 },
  events: { registered: 0, attended: 0 },
  volunteering: { assignments: 0, completed: 0, hours: 0 },
  writing: { opinions: 0, comments: 0 },
  activities: { count: 0, hours: 0, verified: 0, byType: {} },
  leadership: { hosted: 0, duties: 0 },

  /* ── NOT CONTRIBUTION ──────────────────────────────────────────────────
   *
   * Both blocks below are excluded from totalContributions() and from the
   * engagement band, on purpose.
   *
   * `portal` is how often the account was used. In Roundu that measures
   * signal strength and data budget, not commitment — a member running a
   * relief camp from a village with no coverage would score below someone
   * scrolling the site from Islamabad. Counting it as contribution would
   * penalise precisely the people doing the most.
   *
   * `requests` is what the member ASKED FOR — applications, support tickets,
   * guidance. Useful context when reading someone's record, but asking for
   * help is not a service rendered, and a member should never be able to
   * raise their standing by filing more tickets. */
  portal: { activeDays: 0, lastSeen: null, memberSince: null },
  requests: { applications: 0, tickets: 0, guidance: 0, likesGiven: 0 },
});

/**
 * Attendance rate as a percentage of meetings the member was actually invited
 * to — not of every meeting TNR held.
 *
 * Returns null, not 0, when they were invited to nothing. "0%" against a
 * member nobody invited is a false accusation, and it is exactly the number an
 * office bearer would skim past and act on.
 */
export function attendanceRate(m) {
  if (!m || !m.invited) return null;
  return Math.round((m.attended / m.invited) * 1000) / 10;
}

/**
 * A neutral grouping, used ONLY to let an admin filter 293 people down to the
 * ones worth a phone call. Not a rank, not shown as a badge on a member, and
 * never shown to the member themselves.
 */
export function engagementBand(rec) {
  const total = totalContributions(rec);
  if (total === 0) return 'none';
  if (total < 5) return 'some';
  return 'active';
}

export const BANDS = [
  { key: 'active', label: 'Active this year', hint: 'Five or more recorded contributions' },
  { key: 'some',   label: 'Some activity',    hint: 'Between one and four' },
  { key: 'none',   label: 'Nothing recorded', hint: 'No activity recorded for this year' },
];

/** Total contributions across all four groups — a count, not a score. */
export function totalContributions(rec) {
  if (!rec) return 0;
  /* Every group counts once, and equally.
   *
   * No weighting: an hour of volunteering is not worth two comments or half a
   * meeting, and the moment this function starts multiplying, somebody has to
   * defend the multipliers to the people being measured. Volunteer HOURS are
   * deliberately excluded from the count — they are reported separately —
   * because a single 8-hour day would otherwise outweigh a year of showing up. */
  return (rec.meetings?.attended || 0)
    + (rec.events?.attended || 0)
    + (rec.volunteering?.assignments || 0)
    + (rec.writing?.opinions || 0) + (rec.writing?.comments || 0)
    + (rec.activities?.count || 0)
    + (rec.leadership?.hosted || 0) + (rec.leadership?.duties || 0);
}

/** Human date for an activity_date (a plain day, so no timezone conversion). */
export function fmtActivityDate(d) {
  if (!d) return '—';
  const [y, m, day] = String(d).split('-').map(Number);
  if (!y || !m || !day) return String(d);
  return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  });
}
