// ── Membership types ──────────────────────────────────────────────────────
// One registration form serves all four. What the applicant picks is a
// REQUEST; the admin sets the final role at approval, so a person cannot
// place themselves on the Advisory Council by choosing it on a public form.

export const ROLES = [
  {
    key: 'general',
    label: 'General Member',
    blurb: 'Open to every young person of Roundu who supports the aims of TNR.',
    portal: 'Member Portal',
  },
  {
    key: 'uc_team',
    label: 'Union Council Team',
    blurb: 'Volunteers coordinating TNR activity within a Union Council.',
    portal: 'Member Portal + UC tools',
  },
  {
    key: 'cec',
    label: 'Central Executive Committee',
    blurb: 'Office bearers of the central body. Subject to eligibility review.',
    portal: 'Member Portal + public leadership profile',
  },
  {
    key: 'advisory',
    label: 'Advisory Council',
    blurb: 'Senior professionals and academics advising TNR. Subject to review.',
    portal: 'Member Portal + full professional profile',
  },
  /* Country before University, the order the home page presents them in —
     a country ambassador covers a whole country, a university ambassador one
     campus within one. */
  {
    key: 'country_ambassador',
    label: 'Country Ambassador',
    blurb: 'Members representing TNR in the country where they live or study, '
         + 'connecting the Roundu diaspora there to the organisation.',
    portal: 'Member Portal + public ambassador profile',
  },
  {
    key: 'university_ambassador',
    label: 'University Ambassador',
    blurb: 'Students representing TNR at their university or college, linking '
         + 'Roundu students on campus to the organisation.',
    portal: 'Member Portal + public ambassador profile',
  },
];

export const ROLE_KEYS = ROLES.map(r => r.key);
export const roleLabel = (k) => ROLES.find(r => r.key === k)?.label || 'General Member';

/* Display order for the public members directory: Advisory Council first,
   then the Central Executive Committee, then Union Council teams, then general
   members. Lower sorts earlier.

   Kept here rather than as a CASE expression in SQL so it cannot drift out of
   step with the ROLES list above. An unknown or missing role falls to the end
   rather than the front — a member whose role was never set should not be
   presented as leadership. */
/* Ambassadors sort after the Central Executive Committee and before Union
 * Council teams — the same order the public page presents them in, so the
 * directory and the website never disagree about precedence.
 *
 * Country outranks University: one covers a whole country, the other a single
 * campus inside one. */
export const ROLE_RANK = {
  advisory: 0, cec: 1, country_ambassador: 2, university_ambassador: 3,
  uc_team: 4, general: 5,
};
export const roleRank = (role) => ROLE_RANK[role] ?? 99;

/** Roles that get a public leadership profile in the council portal. */
export const LEADERSHIP_ROLES = [
  'advisory', 'cec', 'country_ambassador', 'university_ambassador',
];
export const hasLeadershipProfile = (role) => LEADERSHIP_ROLES.includes(role);

/* Which leadership body a role belongs to, for leadership_profiles.body.
 *
 * A LOOKUP, NOT A CHAIN OF TERNARIES. The chain this replaces ended in
 * `: null`, so every role it did not name fell through silently — which is
 * exactly how a new role gets written with `body = undefined` and nobody
 * finds out until the roster is empty. A missing key here still returns
 * undefined, but it is one line to see and one line to fix. */
const ROLE_BODY = {
  advisory: 'advisory',
  cec: 'executive',
  country_ambassador: 'country_ambassador',
  /* NOT 'university_ambassador'. The body predates this one and is live on
     real profiles; renaming it would need a data migration, and if the code
     shipped first the public section would go empty. See
     supabase/migration_country_ambassadors.sql. */
  university_ambassador: 'ambassador',
};
export const bodyForRole = (role) => ROLE_BODY[role] || null;

/* The four public rosters, in the order the website shows them. Exported so
 * the API, the hook and the admin screen cannot drift into four different
 * opinions about what a body is or what it is called. */
export const LEADERSHIP_BODIES = [
  { key: 'advisory',           label: 'Advisory Council' },
  { key: 'executive',          label: 'Central Executive Committee' },
  { key: 'country_ambassador', label: 'Country Ambassadors' },
  { key: 'ambassador',         label: 'University Ambassadors' },
];

/* The bodies whose cards show an affiliation line — the country or the campus
 * the person covers. Ask through this rather than comparing to a literal:
 * `body === 'ambassador'` reads like "any ambassador" and silently means
 * "university only", which is the trap the naming above leaves behind. */
export const AMBASSADOR_BODIES = ['country_ambassador', 'ambassador'];
export const isAmbassadorBody = (body) => AMBASSADOR_BODIES.includes(body);
export const BODY_KEYS = LEADERSHIP_BODIES.map(b => b.key);
export const bodyLabel = (k) =>
  LEADERSHIP_BODIES.find(b => b.key === k)?.label || 'Leadership';

/**
 * How the membership type reads inside a sentence on the certificate.
 *
 * The plain label works on a card, where it stands alone, but not in prose:
 * "a duly registered Central Executive Committee of TNR" is missing words.
 * Bodies need "member of the …"; General Member is already a noun phrase.
 */
const ROLE_PHRASE = {
  general:  'General Member',
  uc_team:  'member of the Union Council Team',
  cec:      'member of the Central Executive Committee',
  advisory: 'member of the Advisory Council',
  /* "a duly registered University Ambassador of TNR" reads correctly without
   * "member of the" — it is already a noun phrase, like General Member. The
   * same is true of Country Ambassador. */
  university_ambassador: 'University Ambassador',
  country_ambassador: 'Country Ambassador',
};

export const rolePhrase = (role, category) =>
  category ? `${category} Member` : (ROLE_PHRASE[role] || ROLE_PHRASE.general);

/* ── Who may read Executive Committee applications ─────────────────────────
 *
 * Sitting CEC members, plus a named list of individuals who hold the standing
 * to review but not the `cec` role — currently the founder.
 *
 * By membership ID rather than by name or email: the ID is the one identifier
 * that does not change when someone marries, switches address or updates their
 * profile, and it is what the rest of the platform already keys on.
 *
 * This is an ALLOWLIST, so the failure mode is someone being shut out and
 * saying so — not someone quietly gaining sight of other people's answers.
 * Adding a person is a code change on purpose: it is a privacy decision and
 * should leave a trace in the history, not happen through a form.
 */
export const CEC_REVIEWER_MEMBERSHIP_IDS = [
  'TNR-MN-0052',   // Ali Shahid — Founder
];

/** True when this member may read CEC applications. */
export function canReviewCecApplications(member) {
  if (!member) return false;
  if (member.role === 'cec') return true;
  const id = String(member.membership_id || '').trim().toUpperCase();
  return !!id && CEC_REVIEWER_MEMBERSHIP_IDS.includes(id);
}

/* ── Who may read scholarship and fellowship applications ──────────────────
 *
 * THESE THREE PEOPLE, AND NOBODY ELSE.
 *
 * Deliberately NOT role-based, unlike the CEC list above. Holding a seat on
 * the Advisory Council or the Executive Committee does not put someone on this
 * selection panel — the panel is three named people, and it stays three named
 * people when the committees change membership.
 *
 * That distinction matters here more than elsewhere: these applications carry
 * young people's academic records and personal circumstances, and "everyone on
 * a committee" is a group that grows quietly at every election. A list of
 * three does not.
 *
 * Adding a reviewer is a code change on purpose. It is a decision about who
 * sees other people's private information, and it should leave a trace in the
 * history rather than happen through a form somebody forgets they used.
 *
 * READ ONLY. Reviewers advise; the decisions — shortlist, interview, select,
 * reject — stay with admins in the panel, where every action is confirmed,
 * emailed and recorded.
 */
export const OPPORTUNITY_REVIEWER_MEMBERSHIP_IDS = [
  'TNR-MN-0014',   // Sara Batool
  'TNR-MN-0052',   // Ali Shahid
  'TNR-MN-0002',   // Engr. Yasub Akhunzada
];

/** True when this member may read opportunity applications. Membership ID only. */
export function canReviewOpportunityApplications(member) {
  if (!member) return false;
  const id = String(member.membership_id || '').trim().toUpperCase();
  return !!id && OPPORTUNITY_REVIEWER_MEMBERSHIP_IDS.includes(id);
}
