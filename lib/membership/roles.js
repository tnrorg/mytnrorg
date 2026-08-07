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
