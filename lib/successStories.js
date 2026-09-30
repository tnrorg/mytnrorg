/* TNR Success Stories — the shared vocabulary.
 *
 * Imported by the member form, the member API, the admin review queue, the
 * public page and the public API, so all five use the same words for the same
 * things. Safe on the client: no secrets, no server-only imports.
 */

// ── What kind of achievement ───────────────────────────────────────────────
/* Concrete categories, not "Achievement" and "Other".
 *
 * A single free-text field would be filled with "success" three hundred times
 * and the page could never be filtered or counted. These eight are the things
 * young people in Roundu actually report, and the labels are the words they
 * would use themselves.
 */
export const KINDS = [
  { key: 'degree',      label: 'Degree / Graduation', icon: '🎓',
    hint: 'Completed a degree, diploma or matriculation',
    orgLabel: 'University / College' },
  { key: 'job',         label: 'New Job / Appointment', icon: '💼',
    hint: 'Appointed to a post, joined an organisation, promoted',
    orgLabel: 'Employer / Department' },
  { key: 'certificate', label: 'Certificate / Training', icon: '📜',
    hint: 'Completed a course, training or professional certification',
    orgLabel: 'Institute / Awarding body' },
  { key: 'award',       label: 'Award / Recognition', icon: '🏆',
    hint: 'Won a prize, scholarship, medal or public recognition',
    orgLabel: 'Awarded by' },
  { key: 'business',    label: 'Business / Enterprise', icon: '🚀',
    hint: 'Started a business, shop, farm or social enterprise',
    orgLabel: 'Name of the venture' },
  { key: 'sports',      label: 'Sports', icon: '🏅',
    hint: 'Competed or placed in a sporting event',
    orgLabel: 'Event / Team' },
  { key: 'publication', label: 'Research / Publication', icon: '📚',
    hint: 'Published a paper, article or book',
    orgLabel: 'Journal / Publisher' },
  { key: 'other',       label: 'Other Achievement', icon: '⭐',
    hint: 'Anything genuine that does not fit the categories above',
    orgLabel: 'Organisation (if any)' },
];

export const KIND_KEYS = KINDS.map(k => k.key);
export const kindOf    = (k) => KINDS.find(x => x.key === k) || KINDS[KINDS.length - 1];
export const kindLabel = (k) => kindOf(k).label;
export const kindIcon  = (k) => kindOf(k).icon;
/* The "where" field is labelled differently per kind — "University" for a
 * degree, "Employer" for a job. One column, eight labels: the data stays
 * countable while the form stays readable. */
export const orgLabel  = (k) => kindOf(k).orgLabel;

// ── Review states ──────────────────────────────────────────────────────────
export const STATUSES = [
  ['pending',           'Waiting for review'],
  ['published',         'Published'],
  ['changes_requested', 'Sent back for changes'],
  ['rejected',          'Not accepted'],
  ['unpublished',       'Removed from the site'],
];
export const STATUS_KEYS  = STATUSES.map(([k]) => k);
export const STATUS_LABEL = Object.fromEntries(STATUSES);

export const STATUS_TONE = {
  pending:           { bg: 'rgba(30,122,182,.12)',  fg: '#155E8A' },
  published:         { bg: 'rgba(16,140,90,.16)',   fg: '#0A5B3A' },
  changes_requested: { bg: 'rgba(200,154,43,.18)',  fg: '#7A5C10' },
  rejected:          { bg: 'rgba(170,60,60,.12)',   fg: '#8A2F2F' },
  unpublished:       { bg: 'rgba(100,113,105,.12)', fg: '#4A554E' },
};

/** The only state the public page will ever render. */
export const PUBLIC_STATUS = 'published';

/* A member may edit while it is waiting or has been sent back — and not once
 * it is live. See the migration: an achievement is a fact, not a document that
 * gets revised, and a published card that can silently change is a card the
 * approval meant nothing for. */
export const EDITABLE_STATUSES = ['pending', 'changes_requested'];
export const canMemberEdit = (s) => EDITABLE_STATUSES.includes(s);

/** How many a member may have waiting at once. See the migration. */
export const MAX_PENDING = 3;

// ── Validation ─────────────────────────────────────────────────────────────
export const TITLE_MAX = 120;
export const ORG_MAX = 120;
export const DESC_MAX = 1200;
export const DESC_MIN_WORDS = 10;

export const wordCount = (v) =>
  String(v || '').trim().split(/\s+/).filter(Boolean).length;

/**
 * Check a story before it is written. `{ field: message }`; empty means ready.
 *
 * Runs on the client for the red text, and again on the server, which is the
 * one that decides.
 */
export function validateStory(f = {}) {
  const e = {};

  if (!KIND_KEYS.includes(f.kind)) e.kind = 'Choose what kind of achievement this is.';

  const title = String(f.title || '').trim();
  if (title.length < 3) e.title = 'Give it a short title.';
  else if (title.length > TITLE_MAX) e.title = `Keep the title under ${TITLE_MAX} characters.`;

  if (String(f.organisation || '').length > ORG_MAX) {
    e.organisation = `Keep this under ${ORG_MAX} characters.`;
  }

  const words = wordCount(f.description);
  if (!words) {
    e.description = 'Please describe it in a few words.';
  } else if (words < DESC_MIN_WORDS) {
    /* Ten words. Low enough that a member writing in their second language is
     * not shut out, high enough to rule out "done" and "alhamdulillah" — which
     * make a card nobody reading the page learns anything from. */
    e.description = `Please write a little more — at least ${DESC_MIN_WORDS} words.`;
  } else if (String(f.description).length > DESC_MAX) {
    e.description = `Please keep it under ${DESC_MAX} characters.`;
  }

  /* A date is optional, but a date in the future is not a past achievement.
   * One day of slack for timezones — a member in Malaysia submitting on the
   * evening of the 1st is on the 2nd in some readings. */
  if (f.achieved_on) {
    const d = new Date(f.achieved_on).getTime();
    if (!Number.isFinite(d)) e.achieved_on = 'That date could not be read.';
    else if (d > Date.now() + 86400000) e.achieved_on = 'That date is in the future.';
  }

  return e;
}

/** "March 2026" — a month, because that is what the form collects. */
export function achievedLabel(d) {
  if (!d) return '';
  const t = new Date(d);
  if (Number.isNaN(t.getTime())) return '';
  return t.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

/** Initials for the card when a member has no photograph on record. */
export function initialsOf(name) {
  return String(name || 'TNR').trim().split(/\s+/).slice(0, 2)
    .map(w => w.charAt(0).toUpperCase()).join('') || 'T';
}
