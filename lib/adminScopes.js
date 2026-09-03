/* Admin permission areas.
 *
 * An admin account holds a list of SCOPES. A super admin implicitly holds all
 * of them plus the super-only tools, and that is not stored — rank is not a
 * scope, so nobody can be handed super powers by ticking a box.
 *
 * Six areas rather than one switch per tab: a permission screen with 28
 * checkboxes gets filled in by clicking "all", which is the same as having no
 * permissions at all.
 */

export const SCOPES = [
  { key: 'election',   label: 'Election Portal',  icon: '🏛️',
    hint: 'Elections, candidates, voter roll, committee, voting records, results, audit logs' },
  { key: 'membership', label: 'Membership',       icon: '🪪',
    hint: 'Applications, member records, profile requests, card & certificate templates, areas' },
  { key: 'content',    label: 'Website Content',  icon: '🖼️',
    hint: 'Hero slides, leadership, home messages, projects, schools, announcements, branding' },
  { key: 'opinions',   label: 'Opinions',         icon: '✍️',
    hint: 'Review and publish member-written articles' },
  { key: 'inbox',      label: 'Contact Inbox',    icon: '📨',
    hint: 'Messages from the contact, feedback, complaints and support forms' },
  { key: 'cec',        label: 'CEC Recruitment',  icon: '📋',
    hint: 'Committee vacancies and the applications received for them' },
  /* Its own area rather than part of Website Content.
   *
   * Applications carry an applicant's date of birth, contact details,
   * qualification and address. An admin whose job is editing hero slides has
   * no business reading that, and bundling the two would hand it to them. */
  { key: 'opportunities', label: 'Opportunities', icon: '💼',
    hint: 'Scholarships, fellowships and jobs, and the applications members send' },
  /* Its own area, for the same reason Opportunities is.
   *
   * Meetings carry attendance records and the minutes of the Advisory Council
   * and the CEC — who turned up, who did not, and what was decided. That is
   * not something to hand to an admin because they also edit hero slides. */
  { key: 'meetings', label: 'TNR Meetings', icon: '🎥',
    hint: 'Schedule meetings, invite members, attendance, minutes, recordings' },
];

export const SCOPE_KEYS = SCOPES.map(s => s.key);
export const ALL_SCOPES = [...SCOPE_KEYS];

/** Drop anything that is not a real scope. Used on every write. */
export function cleanScopes(list) {
  if (!Array.isArray(list)) return [];
  return [...new Set(list.map(s => String(s || '').trim()).filter(s => SCOPE_KEYS.includes(s)))];
}

export const scopeLabel = (k) => SCOPES.find(s => s.key === k)?.label || k;

/* ── Route → scope map ────────────────────────────────────────────────────
 *
 * Keyed by the FIRST path segment after /api/admin/. Values:
 *
 *   ANY    — any signed-in admin (own account, or a shared lookup)
 *   SUPER  — super admin only
 *   [...]  — holder of at least one of these scopes
 *
 * Every segment that exists must appear here. An unmapped segment is DENIED,
 * not allowed: a new route added later fails loudly and visibly in testing,
 * whereas failing open would hand every admin a permission nobody granted and
 * make no noise about it.
 */
export const ANY = 'ANY';
export const SUPER = 'SUPER';

export const ROUTE_SCOPES = {
  // Pre-auth or own-account. Never scoped.
  login: ANY,
  me: ANY,
  '2fa': ANY,
  // Returns only the sections the caller may see — the route filters itself.
  dashboard: ANY,

  // Super admin only. These routes already call requireSuperAdmin; naming them
  // here as well means a route that ever gets downgraded to requireAdmin by
  // mistake is still refused.
  admins: SUPER,
  visitors: SUPER,
  'voter-data': SUPER,
  'committee-vote': SUPER,

  // ── Election Portal ──
  elections: ['election'],
  candidates: ['election'],
  members: ['election'],          // the VOTER roll, not membership records
  committee: ['election'],
  reminders: ['election'],
  records: ['election'],
  results: ['election'],
  logs: ['election'],
  lock: ['election'],
  positions: ['election'],
  settings: ['election'],         // election settings, read by ElectionsTab

  // ── Membership ──
  membership: ['membership'],
  areas: ['membership'],
  'card-settings': ['membership'],
  'certificate-settings': ['membership'],

  // ── Website content ──
  hero: ['content'],
  leadership: ['content'],
  messages: ['content'],
  announcements: ['content'],       // one-line ticker notices
  news: ['content'],                // full News & Announcements articles
  branding: ['content'],
  projects: ['content'],
  'project-settings': ['content'],
  institutions: ['content'],
  'email-test': ['content'],      // the test-send button on the Branding tab

  // ── Single-area modules ──
  opinions: ['opinions'],
  contact: ['inbox'],
  cec: ['cec'],
  opportunities: ['opportunities'],

  // ── TNR Meetings ──
  // One segment covers the whole module: /api/admin/meetings and everything
  // nested under it (participants, audience, attendance, minutes, documents).
  meetings: ['meetings'],

  // Union councils are a shared lookup: the candidate forms read them and the
  // Areas screen maintains them, so either area is enough.
  unions: ['election', 'membership'],
  // Generic image upload, reached from the certificate and content editors.
  'upload-signature': ['membership', 'content'],
};

/**
 * The requirement for a request path.
 * @returns {'ANY'|'SUPER'|string[]|null} null when the path is not an admin
 *          API route or is unmapped (unmapped ⇒ caller must deny).
 */
export function requirementFor(pathname = '') {
  const m = String(pathname).match(/\/api\/admin\/([^/?#]+)/);
  if (!m) return null;
  const seg = decodeURIComponent(m[1]);
  return Object.prototype.hasOwnProperty.call(ROUTE_SCOPES, seg) ? ROUTE_SCOPES[seg] : null;
}

/** Does this admin token satisfy a requirement? */
export function satisfies(admin, requirement) {
  if (!admin) return false;
  const isSuper = admin.role === 'super_admin' || admin.role === 'superadmin';
  if (isSuper) return true;                 // super admins hold everything
  if (requirement === SUPER) return false;
  if (requirement === ANY) return true;
  if (!Array.isArray(requirement)) return false;
  const held = Array.isArray(admin.scopes) ? admin.scopes : [];
  return requirement.some(s => held.includes(s));
}
