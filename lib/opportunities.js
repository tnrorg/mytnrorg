/* Opportunities — rules shared by the public pages, the member portal, and the
 * admin panel, so the three cannot drift apart.
 *
 * THE ONE THING THIS FILE EXISTS FOR
 * `PUBLIC_COLUMNS` and `MEMBER_ONLY_COLUMNS` below are the boundary between
 * what anyone may read and what only a signed-in member may read. Both API
 * routes select from these lists rather than writing their own, so the two can
 * never disagree — and adding a field to the wrong list is a visible edit to a
 * named constant rather than a quiet change inside a query.
 */

// ── Columns ────────────────────────────────────────────────────────────────

/* Safe for anyone. This is the whole public teaser.
 *
 * Split into columns that have ALWAYS existed and columns added by
 * migration_opportunities_v2.sql.
 *
 * Postgres rejects an entire query for one unknown column, and a public
 * endpoint that treats that as "no rows" goes silently blank — while the admin
 * list, which selects *, keeps working perfectly. That asymmetry is confusing
 * enough to cost an afternoon, and it has already cost one on this project
 * with the home page carousel. So the public query tries the full list, and
 * falls back to the base list if the new columns are not there yet.
 */
export const PUBLIC_COLUMNS_BASE = [
  'id', 'title', 'category', 'organization', 'deadline', 'status', 'created_at',
];

export const PUBLIC_COLUMNS_V2 = [
  'category_other', 'cover_url', 'short_description', 'closes_at', 'pinned', 'published_at',
];

export const PUBLIC_COLUMNS = [...PUBLIC_COLUMNS_BASE, ...PUBLIC_COLUMNS_V2];

/** Signed-in members only. Never selected by a public endpoint. */
export const MEMBER_ONLY_COLUMNS = [
  'full_description', 'eligibility', 'benefits', 'duration', 'location',
  'important_dates', 'instructions', 'required_documents', 'terms',
  'additional_info', 'application_type', 'apply_url', 'external_url',
  'description',
];

export const publicSelect = () => PUBLIC_COLUMNS.join(', ');
export const publicSelectBase = () => PUBLIC_COLUMNS_BASE.join(', ');
export const memberSelect = () => [...PUBLIC_COLUMNS, ...MEMBER_ONLY_COLUMNS].join(', ');
export const memberSelectBase = () =>
  [...PUBLIC_COLUMNS_BASE, 'description', 'eligibility', 'required_documents', 'external_url', 'location'].join(', ');

// ── Categories ─────────────────────────────────────────────────────────────

export const CATEGORIES = [
  'Scholarship', 'Fellowship', 'Job', 'Internship', 'Training',
  'Mentorship', 'Leadership Program', 'Research Opportunity', 'Other',
];

/** Portal filter tabs. Each maps to one or more categories. */
export const MEMBER_TABS = [
  { key: '', label: 'All Opportunities', match: null },
  { key: 'scholarships', label: 'Scholarships', match: ['Scholarship'] },
  { key: 'fellowships', label: 'Fellowships', match: ['Fellowship'] },
  { key: 'jobs', label: 'Jobs & Internships', match: ['Job', 'Internship'] },
  { key: 'training', label: 'Training & Mentorship', match: ['Training', 'Mentorship'] },
];

export const CATEGORY_TONE = {
  'Scholarship':          { bg: 'rgba(23,107,73,.10)',  fg: '#176B49' },
  'Fellowship':           { bg: 'rgba(212,167,44,.16)', fg: '#8A6A0B' },
  'Job':                  { bg: 'rgba(37,99,235,.10)',  fg: '#1D4ED8' },
  'Internship':           { bg: 'rgba(2,132,199,.10)',  fg: '#0369A1' },
  'Training':             { bg: 'rgba(124,58,237,.10)', fg: '#6D28D9' },
  'Mentorship':           { bg: 'rgba(190,24,93,.10)',  fg: '#9D174D' },
  'Leadership Program':   { bg: 'rgba(180,83,9,.10)',   fg: '#B45309' },
  'Research Opportunity': { bg: 'rgba(15,118,110,.10)', fg: '#0F766E' },
  'Other':                { bg: 'rgba(71,85,105,.12)',  fg: '#334155' },
};

/** What to show for a row whose category is 'Other'. */
export const categoryLabel = (o) =>
  (o?.category === 'Other' && o?.category_other?.trim()) ? o.category_other.trim() : (o?.category || 'Other');

// ── Status ─────────────────────────────────────────────────────────────────

export const ADMIN_STATUSES = ['draft', 'published', 'closed', 'archived'];
export const APPLICATION_TYPES = ['none', 'internal', 'external'];

/** Days before the deadline at which a listing starts saying "Closing Soon". */
export const CLOSING_SOON_DAYS = 7;

/* Public status, DERIVED — never stored.
 *
 * "Closing soon" and "closed" both follow from the deadline, and a stored copy
 * would need a scheduled job to stay true. Deriving it means the badge is
 * correct the moment the date passes, with nothing to run and nothing to drift.
 *
 * @returns {'open'|'closing_soon'|'closed'|'draft'}
 */
export function publicStatus(o, now = Date.now()) {
  if (!o) return 'closed';
  if (o.status === 'draft' || o.status === 'archived') return 'draft';
  if (o.status === 'closed') return 'closed';

  const end = o.closes_at || o.deadline;
  if (!end) return 'open';
  // A date-only deadline means "until the end of that day", not midnight at
  // its start — otherwise a deadline of the 30th closes on the 29th evening.
  const t = new Date(o.closes_at ? o.closes_at : `${o.deadline}T23:59:59`).getTime();
  if (Number.isNaN(t)) return 'open';
  if (t < now) return 'closed';
  if (t - now <= CLOSING_SOON_DAYS * 86400000) return 'closing_soon';
  return 'open';
}

export const STATUS_LABEL = {
  open: 'Open', closing_soon: 'Closing Soon', closed: 'Closed', draft: 'Draft',
};
export const STATUS_TONE = {
  open:         { bg: 'rgba(23,107,73,.12)',  fg: '#176B49' },
  closing_soon: { bg: 'rgba(217,119,6,.14)',  fg: '#B45309' },
  closed:       { bg: 'rgba(100,116,139,.14)', fg: '#475569' },
  draft:        { bg: 'rgba(100,116,139,.14)', fg: '#475569' },
};

/** Can a member still submit? Checked again on the server before any insert. */
export const acceptingApplications = (o, now = Date.now()) =>
  o?.application_type === 'internal' && ['open', 'closing_soon'].includes(publicStatus(o, now));

// ── Application status ─────────────────────────────────────────────────────

export const APP_STATUSES = ['submitted', 'shortlisted', 'interview_invited', 'selected', 'rejected', 'withdrawn'];

export const APP_STATUS_LABEL = {
  submitted: 'Submitted',
  shortlisted: 'Shortlisted',
  interview_invited: 'Interview Invited',
  selected: 'Selected',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
};

export const APP_STATUS_TONE = {
  submitted:         { bg: 'rgba(71,85,105,.12)',  fg: '#334155' },
  shortlisted:       { bg: 'rgba(37,99,235,.12)',  fg: '#1D4ED8' },
  interview_invited: { bg: 'rgba(212,167,44,.18)', fg: '#8A6A0B' },
  selected:          { bg: 'rgba(23,107,73,.14)',  fg: '#176B49' },
  rejected:          { bg: 'rgba(220,38,38,.10)',  fg: '#B91C1C' },
  withdrawn:         { bg: 'rgba(100,116,139,.12)', fg: '#475569' },
};

export const INTERVIEW_MODES = ['Online', 'In Person', 'Phone / WhatsApp', 'Other'];

// ── Fellowship questions ───────────────────────────────────────────────────

/* The five questions.
 *
 * Defined here rather than in the form so the server can validate an answer
 * against the same list the member was shown. A submitted value that is not
 * one of these options is rejected — otherwise the admin table would grow
 * free-text variants of "Stable Internet" that no filter can group.
 */
export const FELLOWSHIP_QUESTIONS = [
  {
    key: 'internet',
    label: 'Do you have regular access to the internet?',
    options: ['Stable Internet', 'Limited Internet', 'Mobile Data Only', 'Occasionally Available', 'No Regular Internet'],
  },
  {
    key: 'device',
    label: 'Which device do you have access to for fellowship activities?',
    options: ['Personal Laptop', 'Personal Desktop PC', 'Shared Laptop / PC', 'University / College Computer', 'Smartphone Only', 'No Computer Access'],
  },
  {
    key: 'sessions',
    label: 'Can you regularly attend online fellowship sessions?',
    options: ['Yes', 'No', 'Depends on Schedule'],
  },
  {
    key: 'commitment',
    label: 'How much time can you commit to the fellowship each week?',
    options: ['2–4 Hours', '5–7 Hours', '8–10 Hours', 'More than 10 Hours'],
  },
  {
    key: 'interest',
    label: 'Which area are you most interested in developing through this fellowship?',
    options: ['Leadership', 'Digital & Technology Skills', 'Career Development', 'Entrepreneurship', 'Research & Innovation', 'Community Development', 'Communication & Public Speaking', 'Other'],
    otherKey: 'interest_other',
  },
];

export const DECLARATION_TEXT =
  'I confirm that the information provided in this application is accurate and '
  + 'I agree to follow the fellowship guidelines if selected.';

/**
 * Validate submitted answers against the question list.
 * @returns {object} key → message. Empty when acceptable.
 */
export function validateAnswers(answers = {}, declarationAccepted = false) {
  const e = {};
  for (const q of FELLOWSHIP_QUESTIONS) {
    const v = String(answers[q.key] ?? '').trim();
    if (!v) { e[q.key] = 'Please choose an option.'; continue; }
    if (!q.options.includes(v)) { e[q.key] = 'Please choose one of the listed options.'; continue; }
    if (q.otherKey && v === 'Other') {
      const other = String(answers[q.otherKey] ?? '').trim();
      if (!other) e[q.otherKey] = 'Please tell us which area.';
      else if (other.length > 120) e[q.otherKey] = 'Please keep this under 120 characters.';
    }
  }
  if (!declarationAccepted) e.declaration = 'Please confirm the declaration to submit.';
  return e;
}

/** Only known keys are stored — a crafted request cannot smuggle extra fields. */
export function cleanAnswers(answers = {}) {
  const out = {};
  for (const q of FELLOWSHIP_QUESTIONS) {
    if (answers[q.key] !== undefined) out[q.key] = String(answers[q.key]).slice(0, 200);
    if (q.otherKey && answers[q.otherKey] !== undefined) {
      out[q.otherKey] = String(answers[q.otherKey]).slice(0, 200);
    }
  }
  return out;
}

// ── Member profile auto-fetch ──────────────────────────────────────────────

/* What the application shows back to the applicant, read from their profile.
 *
 * `required` marks the values the committee needs. When one is missing the
 * form asks for it — and only then. Asking a member to retype a name the
 * system already holds is how a two-minute application becomes a form nobody
 * finishes.
 */
export const PROFILE_FETCH = [
  { key: 'full_name',        label: 'Full Name',            required: true },
  { key: 'membership_id',    label: 'Membership ID',        required: true },
  { key: 'date_of_birth',    label: 'Date of Birth',        required: true,  type: 'date' },
  { key: 'gender',           label: 'Gender',               required: false },
  { key: 'email',            label: 'Email',                required: true,  type: 'email' },
  { key: 'mobile',           label: 'Mobile / WhatsApp',    required: true },
  { key: 'education_level',  label: 'Current Qualification', required: true },
  { key: 'profession',       label: 'Field / Profession',   required: false },
  { key: 'current_address',  label: 'Current Address',      required: false },
  { key: 'permanent_address', label: 'Permanent Address',   required: false },
];

/** Which required profile values are missing, so the form can ask for those only. */
export const missingProfileFields = (profile = {}) =>
  PROFILE_FETCH.filter(f => f.required && !String(profile[f.key] ?? '').trim());

export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', {
  day: 'numeric', month: 'long', year: 'numeric',
}) : '');
