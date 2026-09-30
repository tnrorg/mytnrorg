/* Union Council Coordinator recruitment — the shared vocabulary.
 *
 * Imported by the member form, the member API, the admin review screen and the
 * exports, so all four show an applicant the same question they answered and
 * the same commitment they agreed to. Safe on the client: no secrets and no
 * server-only imports.
 *
 * THE DECISION THIS FILE ENCODES
 *
 * A member fills in almost nothing. Name, membership number, Union Council,
 * addresses, WhatsApp, email, education and profession are all already on the
 * membership record, so the form shows them and the server copies them. The
 * member writes one answer and ticks one box.
 *
 * That is not only convenience. A form that asks a member to retype their own
 * address produces a second, divergent copy of it that nobody maintains — and
 * six months later the committee has two addresses for one person and no way
 * to tell which is current. Asking once, in one place, is the whole reason the
 * membership record exists.
 */

// ── Review statuses ────────────────────────────────────────────────────────
/* The same six the Executive Committee process uses. Deliberately identical:
 * an office bearer who has reviewed CEC applications already knows what
 * "shortlisted" means here, and two review vocabularies in one organisation is
 * two things to explain to every new committee. */
export const APP_STATUSES = [
  ['new',          'New'],
  ['shortlisted',  'Shortlisted'],
  ['interviewed',  'Interviewed'],
  ['selected',     'Selected'],
  ['not_selected', 'Not selected'],
  ['withdrawn',    'Withdrawn'],
];
export const APP_STATUS_KEYS = APP_STATUSES.map(([k]) => k);
export const APP_STATUS_LABEL = Object.fromEntries(APP_STATUSES);

export const APP_STATUS_TONE = {
  new:          { bg: 'rgba(30,122,182,.12)',  fg: '#155E8A' },
  shortlisted:  { bg: 'rgba(200,154,43,.16)',  fg: '#7A5C10' },
  interviewed:  { bg: 'rgba(120,90,190,.12)',  fg: '#5A3E9A' },
  selected:     { bg: 'rgba(16,140,90,.16)',   fg: '#0A5B3A' },
  not_selected: { bg: 'rgba(100,113,105,.12)', fg: '#4A554E' },
  withdrawn:    { bg: 'rgba(170,60,60,.12)',   fg: '#8A2F2F' },
};

export const ROUND_STATUSES = [
  ['draft',  'Draft — not visible'],
  ['open',   'Open — accepting applications'],
  ['closed', 'Closed'],
];
export const ROUND_STATUS_KEYS = ROUND_STATUSES.map(([k]) => k);

// ── The question ───────────────────────────────────────────────────────────
export const MOTIVATION_QUESTION =
  'Why do you want to serve as a TNR UC Coordinator?';

export const MOTIVATION_HINT =
  'Write in your own words. What you would work on in your Union Council, and '
  + 'what you have already done there, is more useful to the committee than a '
  + 'general statement.';

// ── The commitment ─────────────────────────────────────────────────────────
/* Kept verbatim from the approved paper form, and stored on each application
 * alongside the tick. See the note in the migration: when this wording is
 * revised, past applications must keep showing the wording their applicants
 * actually read. */
export const COMMITMENT_TEXT =
  'I confirm that the information provided above is accurate and that, if '
  + 'selected, I will perform my responsibilities as a TNR UC Coordinator with '
  + 'commitment, transparency, and respect for the organization’s rules.';

// ── The details the system fills in ────────────────────────────────────────
/* Order and labels match the paper form, so a member who has seen the printed
 * version recognises the screen. `key` is the column on the application. */
export const SNAPSHOT_FIELDS = [
  ['full_name',         'Name'],
  ['membership_id',     'TNR Membership Number'],
  ['union_council',     'Union Council'],
  ['permanent_address', 'Permanent Address'],
  ['current_residence', 'Current Place of Residence'],
  ['whatsapp',          'WhatsApp'],
  ['email',             'Email Address'],
  ['education',         'Education / Qualification'],
  ['profession',        'Profession / Occupation'],
];

/** Join the parts of an address that are actually present. */
const join = (...parts) =>
  parts.map(p => String(p ?? '').trim()).filter(Boolean).join(', ');

/* A name is joined by a SPACE, not by the comma `join` uses.
 *
 * Reusing join here produced "Shabbir, Hussain" on the one path that needs
 * this — a record whose generated full_name column is absent. Two separators
 * doing two jobs, rather than one being borrowed for both. */
const spaced = (...parts) =>
  parts.map(p => String(p ?? '').trim()).filter(Boolean).join(' ');

/**
 * Build the snapshot from a membership record.
 *
 * ONE function, called only by the server. The member page displays what the
 * server returns rather than computing its own copy — if the two disagreed,
 * the member would confirm one set of details and the committee would read
 * another, and nothing on either screen would reveal it.
 *
 * @param {object} m   a row from membership_members
 * @param {object} [p] the matching member_profiles row, if there is one
 */
export function snapshotFrom(m = {}, p = {}) {
  return {
    full_name: String(m.full_name || spaced(m.first_name, m.last_name) || '').trim(),
    membership_id: String(m.membership_id || '').trim(),
    union_council: String(m.union_council || '').trim(),

    /* Permanent address is the home village within the Union Council — that is
     * how the organisation records where a member is from, and it is what the
     * membership form collected. There is no separate free-text permanent
     * address column to read. */
    permanent_address: join(m.village, m.union_council, 'Roundu, Gilgit-Baltistan'),

    /* Where they live NOW, which for a good number of members is Islamabad,
     * Karachi or abroad. Falls back to the permanent address only when nothing
     * current was ever recorded — an empty line here reads as a missing answer
     * rather than as "same as permanent". */
    current_residence:
      join(p?.city || m.current_city, m.current_state_province, m.current_country)
      || join(m.village, m.union_council),

    /* The profile's WhatsApp number if the member gave one, otherwise their
     * registered mobile. Most members use the same number for both and never
     * fill the profile field. */
    whatsapp: String(p?.whatsapp || m.mobile || '').trim(),
    email: String(m.email || '').trim(),
    education: join(m.education_level, m.field_of_study),
    profession: join(m.profession || m.current_position, m.organization_name),
  };
}

/** Which snapshot lines came back empty — the member is told to fix these. */
export function missingDetails(snap = {}) {
  /* Deliberately NOT every field. A member with no WhatsApp number or no
   * recorded profession can still serve as a coordinator, and blocking the
   * application on those would turn a recruitment form into a profile chore.
   * These four are the ones a committee cannot review without. */
  const REQUIRED_FOR_REVIEW = ['full_name', 'membership_id', 'union_council', 'email'];
  return REQUIRED_FOR_REVIEW.filter(k => !String(snap?.[k] || '').trim());
}

// ── Validation ─────────────────────────────────────────────────────────────
export const MOTIVATION_MIN_WORDS = 20;
export const MOTIVATION_MAX = 3000;

export const wordCount = (v) =>
  String(v || '').trim().split(/\s+/).filter(Boolean).length;

/**
 * Check a submission. Returns `{ field: message }`; empty means it is ready.
 *
 * Runs on the client for the red text under the box, and again on the server,
 * which is the one that counts — the client's copy can be skipped entirely by
 * anyone willing to use the browser console.
 */
export function validateApplication(f = {}) {
  const e = {};

  const words = wordCount(f.motivation);
  if (!words) {
    e.motivation = 'Please answer this question.';
  } else if (words < MOTIVATION_MIN_WORDS) {
    /* Twenty words is low on purpose. It is enough to rule out "ok" and "I am
     * interested", and not so high that it becomes a writing test — this post
     * is volunteer coordination in a Union Council, not an essay competition,
     * and several capable members will be writing in their second language. */
    e.motivation = `Please write a little more — at least ${MOTIVATION_MIN_WORDS} words.`;
  } else if (String(f.motivation).length > MOTIVATION_MAX) {
    e.motivation = `Please keep it under ${MOTIVATION_MAX} characters.`;
  }

  if (!f.commitment_accepted) {
    e.commitment_accepted = 'Please confirm the commitment before submitting.';
  }

  return e;
}
