// Profile section registry — server + client share this so the API and UI
// can never drift apart.
export const SECTIONS = {
  education:  { table: 'member_education',            label: 'Education' },
  experience: { table: 'member_experience',           label: 'Work Experience' },
  skills:     { table: 'member_skills',               label: 'Skills' },
  projects:   { table: 'member_projects',             label: 'Projects' },
  certifications: { table: 'member_certifications',   label: 'Certifications' },
  languages:  { table: 'member_languages',            label: 'Languages' },
  volunteer:  { table: 'member_volunteer_experience', label: 'Volunteer Experience' },
};

// Columns a member may write, per section. Anything else is ignored — this is
// the whitelist that prevents members from injecting member_id, status, etc.
export const ALLOWED = {
  education:  ['qualification','degree','field_of_study','institution','start_date','end_date','currently_studying','grade','description','sort_order'],
  experience: ['job_title','organization','employment_type','location','start_date','end_date','currently_working','responsibilities','achievements','sort_order'],
  skills:     ['name','category','level','sort_order'],
  projects:   ['name','description','technologies','project_url','github_url','image_url','sort_order'],
  certifications: ['name','issuer','issue_date','expiry_date','credential_id','credential_url','file_url','sort_order'],
  languages:  ['language','proficiency','sort_order'],
  volunteer:  ['role','organization','area','start_date','end_date','currently_active','description','sort_order'],
};

// Free-to-edit profile fields (member_profiles table).
export const PROFILE_FIELDS = [
  'headline','summary','country','city','address','whatsapp',
  'linkedin_url','portfolio_url','github_url','tnr_contributions','awards',
];

// Changing any of these requires ADMIN APPROVAL — never written directly.
// Fields a member may change themselves — written straight through, so the
// public profile updates immediately with no admin request.
export const SELF_EDITABLE_CORE = [
  /* Name, mobile, village and union council are NO LONGER here.
   *
   * They were self-editable, while the admin screen told the committee that
   * "members cannot change their name, contact details or location directly —
   * those changes appear here for review". Both statements cannot be true, and
   * the one on the screen is the one the committee was relying on: the review
   * queue sat permanently empty, which reads as "nobody is changing anything"
   * rather than "nothing is being checked".
   *
   * They now go through approval. See SENSITIVE_FIELDS below. */

  // Date of birth. Self-editable because the commonest reason to change it is
  // that it was mistyped at registration, and making someone email the
  // committee to fix a typo in their own birthday is not a control worth
  // having. The API still enforces the same age limits as the application
  // form, so this cannot be used to slip outside them.
  'date_of_birth',
  // Added after these questions joined the application form. Existing members
  // — including CEC and Advisory Council — were approved before they existed,
  // so the only way they can ever be filled is by the member themselves.
  // Self-edit rather than approval-gated: none of them is an identity claim.
  'current_country', 'current_country_code',
  'current_state_province', 'current_state_code', 'current_city',
  'profession', 'profession_other', 'organization_name',
];

// Still routed through approval, and only these two:
//   email       — it is the login identity, so an instant change could lock a
//                 member out or be used to take an account over.
//   category_id — a classification the committee assigns, not a self-declared
//                 value.
/* Changing any of these needs committee approval — never written directly.
 *
 *   first_name / last_name  identity, and it is printed on the membership card
 *                           and the certificate
 *   email                   the login identity; an instant change could lock a
 *                           member out, or be used to take an account over
 *   mobile                  the contact of record, and the second identifier
 *                           the duplicate check relies on
 *   village / union_council these drive the UC teams and every area statistic
 *                           the organisation publishes
 *   category_id             a classification the committee assigns, not a
 *                           self-declared value
 *
 * Everything else a member can simply change. The test is whether a wrong
 * value would mislead somebody else — not whether it matters to the member.
 */
export const SENSITIVE_FIELDS = [
  'first_name', 'last_name', 'email', 'mobile', 'village', 'union_council', 'category_id',
];
// Members can never change these at all.
export const FORBIDDEN_FIELDS = ['membership_id','status','approved_by','approved_at','public_visible'];

export const pick = (obj, keys) =>
  keys.reduce((o, k) => { if (obj[k] !== undefined) o[k] = obj[k] === '' ? null : obj[k]; return o; }, {});

// ── Profile completion ─────────────────────────────────────────────────────
// Weighted across the whole profile, not just the registration fields.
//
// The previous measure counted only the 11 fields collected at registration —
// every one of which is now mandatory — so every approved member showed 100%
// immediately and the figure told them nothing. Completion should reflect the
// parts of the profile a member actually still has to fill in.
export const COMPLETION_WEIGHTS = [
  { key: 'basics',         label: 'Personal details',   weight: 20 },
  { key: 'photo',          label: 'Profile photo',      weight: 10 },
  { key: 'about',          label: 'About you',          weight: 10 },
  { key: 'education',      label: 'Education',          weight: 15 },
  { key: 'experience',     label: 'Work experience',    weight: 15 },
  { key: 'skills',         label: 'Skills',             weight: 10 },
  { key: 'languages',      label: 'Languages',          weight: 5 },
  { key: 'certifications', label: 'Certifications',     weight: 5 },
  { key: 'projects',       label: 'Projects',           weight: 5 },
  { key: 'volunteer',      label: 'Volunteer work',     weight: 5 },
];

const BASIC_FIELDS = ['first_name', 'last_name', 'email', 'mobile', 'gender',
  'village', 'union_council', 'education_level', 'field_of_study', 'current_position'];

/**
 * @param {object} member  the membership_members row
 * @param {object} data    { profile, education: [], experience: [], ... }
 * @returns {{ percent:number, done:string[], missing:{key,label,weight}[] }}
 */
export function profileCompletion(member = {}, data = {}) {
  const has = (k) => {
    switch (k) {
      case 'basics': return BASIC_FIELDS.every(f => String(member[f] || '').trim());
      case 'photo':  return !!member.photo_url;
      case 'about':  return !!String(data.profile?.bio || data.profile?.about || '').trim();
      default:       return (data[k] || []).length > 0;
    }
  };

  let earned = 0;
  const done = [];
  const missing = [];
  for (const s of COMPLETION_WEIGHTS) {
    if (has(s.key)) { earned += s.weight; done.push(s.key); }
    else missing.push(s);
  }
  // Sort what is missing by weight, so the prompt names the item worth most.
  missing.sort((a, b) => b.weight - a.weight);
  return { percent: Math.round(earned), done, missing };
}
