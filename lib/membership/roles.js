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
export const ROLE_RANK = { advisory: 0, cec: 1, uc_team: 2, general: 3 };
export const roleRank = (role) => ROLE_RANK[role] ?? 99;

/** Roles that get a public leadership profile in the council portal. */
export const LEADERSHIP_ROLES = ['advisory', 'cec'];
export const hasLeadershipProfile = (role) => LEADERSHIP_ROLES.includes(role);

/** Which leadership body a role belongs to, for leadership_profiles.body. */
export const bodyForRole = (role) =>
  role === 'advisory' ? 'advisory' : role === 'cec' ? 'executive' : null;

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
