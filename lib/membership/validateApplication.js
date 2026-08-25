import {
  PROFESSIONS, photoOptionalFor, GENDER_SELF_DESCRIBE,
  HEARD_ABOUT, needsReferrer, needsHeardDetail,
  WHY_JOIN_OPTIONS, YOUTH_ISSUE_OPTIONS,
} from './options';

// Shared validation for the membership application.
// Imported by BOTH the form and the API route so the rules can never drift
// apart — the browser gives instant feedback, the server enforces the same
// thing for anyone posting directly to the endpoint.

export const REQUIRED_LABELS = {
  applied_role: 'Membership type',
  photo_data: 'Profile photo',
  first_name: 'First name',
  last_name: 'Last name',
  gender: 'Gender',
  gender_self_described: 'Your gender',
  date_of_birth: 'Date of birth',
  current_country: 'Country',
  current_state_province: 'State / Province',
  current_city: 'City',
  union_council: 'Union Council',
  village: 'Village / Area',
  mobile: 'Mobile / WhatsApp number',
  email: 'Email address',
  profession: 'Profession / Field',
  profession_other: 'Your profession',
  organization_name: 'Organisation',
  education_level: 'Highest level of education',
  // Kept for older records and server messages. The form no longer asks for
  // it — `profession` replaced it, and the API fills this column from that.
  field_of_study: 'Field of study / profession',
  current_position: 'Current position',
  position_other: 'Your position',
  why_join: 'Why you want to join',
  heard_about: 'How you heard about TNR',
  heard_about_detail: 'Where you heard about TNR',
  referred_by_name: 'Referring member’s name',
  contribution_areas: 'Contribution areas',
  leadership_view: 'Leadership question',
  youth_issues: 'Issues facing the youth',
  declaration_accepted: 'Declaration',
  password: 'Password', password_confirm: 'Confirm password',
};

// Field → the form section it lives in, used to flag incomplete sections.
export const FIELD_SECTION = {
  applied_role: 'R',
  photo_data: 'A',
  // Same step as `gender` — without this the error has no step to belong to,
  // so "Next" would let the applicant walk past an unanswered required field.
  first_name: 'A', last_name: 'A', gender: 'A', gender_self_described: 'A',
  date_of_birth: 'A', mobile: 'A', email: 'A',
  current_country: 'A', current_state_province: 'A', current_city: 'A',
  union_council: 'A', village: 'A',
  education_level: 'B', current_position: 'B', position_other: 'B',
  organization_name: 'B', profession: 'B', profession_other: 'B',
  why_join: 'C', contribution_areas: 'C', leadership_view: 'C', youth_issues: 'C',
  // Sits with the motivation questions rather than in Personal Information:
  // it is about how they found TNR, not about who they are.
  heard_about: 'C', heard_about_detail: 'C', referred_by_name: 'C',
  declaration_accepted: 'D',
  password: 'V', password_confirm: 'V',
};

/* MIN_TEXT is gone. It existed to stop "asdf" passing as a written answer to
   the two paragraph questions; both are now a choice from a fixed list, which
   makes that impossible by construction. */

/* The organisation field is one database column, `organization_name`, with a
   label that follows the chosen position. A student does not have an
   "employer" and a freelancer does not have a "department"; asking with the
   right word gets a usable answer instead of a blank. */
const ORG_LABELS = {
  'Student': 'Institution / University',
  'Employee': 'Organisation / Employer',
  'Government Employee': 'Department / Organisation',
  'Private-Sector Employee': 'Organisation / Employer',
  'Business Owner': 'Business / Organisation Name',
  'Freelancer': 'Company / Platform',
  'Teacher or Educator': 'School / Institution',
  'Social Worker': 'Organisation',
  'Retired': 'Former Organisation',
};

/** Positions with no organisation to name — the field is hidden for these. */
const NO_ORG = ['Unemployed', 'Job Seeker'];

export const organisationLabel = (position) =>
  ORG_LABELS[position] || 'Organisation / Institution';

/** True when the field should be shown AND required. */
export const needsOrganisation = (position) =>
  !!position && !NO_ORG.includes(position);

/** Freelancers list a platform rather than an employer, so it is optional. */
export const organisationOptional = (position) => position === 'Freelancer';

// TNR is a youth organisation, so membership is bounded at both ends.
export const MIN_AGE = 14;
export const MAX_AGE = 55;

/** Whole years between a date of birth and today. */
export function ageFrom(dob) {
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let years = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) years--;   // birthday not yet reached
  return years;
}

export function validateApplication(f = {}) {
  const e = {};
  const str = (k) => String(f[k] ?? '').trim();

  if (!str('applied_role')) e.applied_role = 'Please choose a membership type.';

  // The photo appears on the membership card, so it is required — except for
  // women, for whom publishing a photograph is a real privacy concern in this
  // community. A female applicant who leaves it blank gets a respectful
  // placeholder icon everywhere her photo would have appeared.
  //
  // Gender is read before this runs, so an applicant who has not yet chosen one
  // is not nagged about the photo: the gender error is the one to fix first.
  const photo = str('photo_data');
  const gender = str('gender');
  // One shared rule (lib/membership/options.js). This used to be spelled out
  // here and again in the form, and the two had already drifted: "Prefer not to
  // say" was accepted without a photo by one and rejected by the other.
  const photoOptional = photoOptionalFor(gender);

  if (!photo) {
    if (gender && !photoOptional) e.photo_data = 'A profile photo is required.';
  } else if (!/^data:image\/(png|jpe?g|webp);base64,/i.test(photo)) {
    e.photo_data = 'Photo must be a JPG, PNG or WEBP image.';
  }

  for (const k of ['first_name', 'last_name', 'gender',
                   'current_country', 'current_state_province', 'current_city',
                   'union_council', 'village',
                   'education_level', 'current_position', 'profession']) {
    if (!str(k)) e[k] = `${REQUIRED_LABELS[k]} is required.`;
  }

  if (!str('first_name')) { /* already flagged */ }
  else if (str('first_name').length < 2) e.first_name = 'Please enter your full first name.';
  if (str('last_name') && str('last_name').length < 2) e.last_name = 'Please enter your full last name.';

  // Age is derived from the date of birth rather than typed, so it cannot go
  // stale and cannot be inflated to meet a minimum.
  const dob = str('date_of_birth');
  if (!dob) e.date_of_birth = 'Date of birth is required.';
  else {
    const d = new Date(dob);
    if (Number.isNaN(d.getTime())) e.date_of_birth = 'Please enter a valid date.';
    else {
      const years = ageFrom(dob);
      if (d > new Date()) e.date_of_birth = 'Date of birth cannot be in the future.';
      else if (years < MIN_AGE)
        e.date_of_birth = `Applicants must be at least ${MIN_AGE} years old.`;
      else if (years > MAX_AGE)
        e.date_of_birth = `Membership is open to applicants up to ${MAX_AGE} years of age.`;
    }
  }

  const mobile = str('mobile');
  const digits = mobile.replace(/\D/g, '');
  if (!mobile) e.mobile = 'Mobile / WhatsApp number is required.';
  else if (digits.length < 10 || digits.length > 15) e.mobile = 'Please enter a valid mobile number.';

  const email = str('email');
  if (!email) e.email = 'Email address is required.';
  else if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email)) e.email = 'Please enter a valid email address.';

  /* Both are now a choice from a fixed list, not a written paragraph.
   *
   * The minimum-length rule is gone — it existed to stop "asdf" passing as an
   * answer, and a fixed list stops that by construction.
   *
   * The value is checked AGAINST THE LIST rather than merely being non-empty.
   * Otherwise a request posted straight to the endpoint could put arbitrary
   * text in a column the committee will later try to group and count, and one
   * stray value is enough to make a tally wrong without looking wrong.
   *
   * Old applications hold free text in these columns and are untouched — this
   * governs new submissions only. */
  for (const [k, allowed] of [['why_join', WHY_JOIN_OPTIONS], ['youth_issues', YOUTH_ISSUE_OPTIONS]]) {
    const v = str(k);
    if (!v) e[k] = `${REQUIRED_LABELS[k]} is required.`;
    else if (!allowed.includes(v)) e[k] = 'Please choose one of the listed options.';
  }

  // "Other" is only meaningful once they say what it is.
  if (str('current_position') === 'Other' && !str('position_other'))
    e.position_other = 'Please type your current position.';

  // The profession field is a typed combo box, so a value that is not on the
  // list has to be caught here — otherwise a typo saves as a one-off category
  // and quietly fragments the profession statistics.
  const prof = str('profession');
  if (prof && !PROFESSIONS.includes(prof))
    e.profession = 'Please choose a profession from the list, or select Other.';
  if (prof === 'Other' && !str('profession_other'))
    e.profession_other = 'Please type your profession.';

  // Choosing to self-describe and then leaving the box empty records nothing
  // at all, so the box is required once that option is picked. The cap is
  // generous but present: this text is shown publicly in the member directory.
  if (str('gender') === GENDER_SELF_DESCRIBE) {
    const self = str('gender_self_described');
    if (!self) e.gender_self_described = 'Please describe your gender.';
    else if (self.length > 60) e.gender_self_described = 'Please keep this under 60 characters.';
  }

  // The organisation is required for anyone who has one, and hidden entirely
  // for those who do not — asking an unemployed applicant to name an employer
  // is both pointless and a little insulting.
  if (needsOrganisation(str('current_position')) && !organisationOptional(str('current_position'))
      && !str('organization_name'))
    e.organization_name = `${organisationLabel(str('current_position'))} is required.`;

  if (!Array.isArray(f.contribution_areas) || !f.contribution_areas.length)
    e.contribution_areas = 'Please select at least one area.';

  /* How they found TNR.
   *
   * Required, because an optional question on a long form is skipped by most
   * people and the answers are then too patchy to conclude anything from —
   * which is worse than not asking, since it looks like data.
   *
   * The follow-up boxes are required only once the option that needs them is
   * chosen. Picking "Referred by a member" and naming nobody records nothing,
   * and the same is true of "Other" with an empty box. */
  const heard = str('heard_about');
  if (!heard) e.heard_about = 'Please tell us how you heard about TNR.';
  else if (!HEARD_ABOUT.includes(heard)) e.heard_about = 'Please choose one of the options.';

  if (needsReferrer(heard)) {
    const who = str('referred_by_name');
    if (!who) e.referred_by_name = 'Please enter the name of the member who referred you.';
    else if (who.length < 3) e.referred_by_name = 'Please enter their full name.';
    else if (who.length > 120) e.referred_by_name = 'Please keep this under 120 characters.';
  }
  if (needsHeardDetail(heard)) {
    const how = str('heard_about_detail');
    if (!how) e.heard_about_detail = 'Please tell us where you heard about TNR.';
    else if (how.length > 200) e.heard_about_detail = 'Please keep this under 200 characters.';
  }
  if (!str('leadership_view')) e.leadership_view = 'Please choose an answer.';
  if (!f.declaration_accepted) e.declaration_accepted = 'You must accept the declaration to submit.';

  // ── Password ────────────────────────────────────────────────────────────
  // CNIC upload was removed from the form. The database columns and the admin
  // viewer remain, so identity documents can be reinstated later without a
  // migration — but nothing asks for them and nothing requires them.
  //
  // The applicant sets their own sign-in password here, so no invitation link
  // is needed after approval.
  const pw = String(f.password ?? '');
  if (!pw) e.password = 'Please choose a password.';
  else if (pw.length < 8) e.password = 'Password must be at least 8 characters.';
  else if (!/[a-zA-Z]/.test(pw) || !/\d/.test(pw))
    e.password = 'Use at least one letter and one number.';
  else if (String(f.password_confirm ?? '') !== pw)
    e.password_confirm = 'Passwords do not match.';

  return e;
}

export const isComplete = (f) => Object.keys(validateApplication(f)).length === 0;

/** Sections that still have at least one problem, e.g. ['A','C']. */
export const incompleteSections = (errors) =>
  [...new Set(Object.keys(errors).map(k => FIELD_SECTION[k]).filter(Boolean))].sort();

// ── Multi-step form wiring ────────────────────────────────────────────────
// The steps deliberately mirror FIELD_SECTION, so "which fields belong to
// step 3" has exactly one answer shared by the form and the server.
export const STEPS = [
  { key: 'R', title: 'Membership Type', blurb: 'Choose how you would like to join TNR. The rest of the form is the same for everyone.' },
  { key: 'A', title: 'Personal Information', blurb: 'Who you are and how the committee can reach you.' },
  { key: 'B', title: 'Education & Profession', blurb: 'Your studies and what you currently do.' },
  { key: 'C', title: 'Motivation & Contribution', blurb: 'Why you want to join and where you can help.' },
  { key: 'V', title: 'Create Your Password', blurb: 'Choose the password you will use to sign in once your application is approved.' },
  // Declaration sits last before Review on purpose: the applicant should be
  // agreeing to the terms once everything else — including identity — has been
  // provided, not part-way through.
  { key: 'D', title: 'Declaration', blurb: 'Confirm you accept the membership declaration.' },
  { key: 'REVIEW', title: 'Review & Submit', blurb: 'Check your answers before sending.' },
];

/** Field keys belonging to a step, in the order they appear on the form. */
export const fieldsInStep = (key) =>
  Object.keys(FIELD_SECTION).filter(f => FIELD_SECTION[f] === key);

/** Errors limited to one step — used to gate the Continue button. */
export function stepErrors(f, key) {
  const all = validateApplication(f);
  if (key === 'REVIEW') return all;                 // final gate = everything
  const keys = fieldsInStep(key);
  return Object.fromEntries(Object.entries(all).filter(([k]) => keys.includes(k)));
}
export const isStepComplete = (f, key) => Object.keys(stepErrors(f, key)).length === 0;
