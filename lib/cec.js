/* Shared vocabulary for Executive Committee recruitment.
 *
 * The question wording lives here, not in the page, so the form, the admin
 * review screen and any future export all show an applicant the same question
 * they actually answered.
 */

export const VACANCY_STATUSES = [
  ['open',   'Open'],
  ['closed', 'Closed'],
  ['draft',  'Draft — not public'],
];

export const APP_STATUSES = [
  ['new',          'New'],
  ['shortlisted',  'Shortlisted'],
  ['interviewed',  'Interviewed'],
  ['selected',     'Selected'],
  ['not_selected', 'Not selected'],
  ['withdrawn',    'Withdrawn'],
];

export const APP_STATUS_LABEL = Object.fromEntries(APP_STATUSES);

export const APP_STATUS_TONE = {
  new:          { bg: 'rgba(30,122,182,.12)',  fg: '#155E8A' },
  shortlisted:  { bg: 'rgba(200,154,43,.16)',  fg: '#7A5C10' },
  interviewed:  { bg: 'rgba(120,90,190,.12)',  fg: '#5A3E9A' },
  selected:     { bg: 'rgba(16,140,90,.16)',   fg: '#0A5B3A' },
  not_selected: { bg: 'rgba(100,113,105,.12)', fg: '#4A554E' },
  withdrawn:    { bg: 'rgba(170,60,60,.12)',   fg: '#8A2F2F' },
};

/* The written questions, in the order the draft sets them.
 *
 * `scenario` is deliberately absent: it comes from the chosen vacancy, because
 * each position is asked a different situational question. */
export const WRITTEN_QUESTIONS = [
  ['relevant_experience',
   'Describe any experience you have that is relevant to the position you are applying for.'],
  ['challenge_answer',
   'What is the biggest challenge currently facing youth organizations in Roundu, and what practical solution would you propose if selected?'],
  ['leadership_answer',
   'Tell us about a situation where you demonstrated leadership, integrity, or teamwork. What was the outcome, and what did you learn from the experience?'],
  ['vision_answer',
   'Why do you want to serve in this position, and what three initiatives would you implement during your tenure to strengthen Tehreek-e-Nojawanan Roundu (TNR)?'],
];

export const DECLARATION =
  'I certify that the information provided in this application is true and accurate ' +
  'to the best of my knowledge. I understand that providing false information may ' +
  'result in disqualification from the selection process.';

/** Every field an applicant must complete. Shared by the form and the API so
 *  the two cannot disagree about what counts as finished. */
export const REQUIRED = {
  vacancy_id: 'Position applying for',
  full_name: 'Full name',
  // A face against a set of answers is how a shortlisting panel keeps track of
  // who is who. Validated by key, so it is enforced on the server too — this
  // file is imported by both the form and the API route.
  photo_data: 'Passport-size photograph',
  email: 'Email address',
  mobile: 'Phone number',
  education_level: 'Educational qualification',
  current_position: 'Current occupation',
  relevant_experience: 'Relevant experience',
  scenario_answer: 'Scenario question',
  challenge_answer: 'Biggest challenge facing youth organizations',
  leadership_answer: 'Leadership, integrity or teamwork',
  vision_answer: 'Vision statement',
  declaration_accepted: 'Declaration',
};

/** Answers this short are almost always placeholder text ("n/a", "ok"). */
const MIN_WORDS = 15;
const words = (v) => String(v || '').trim().split(/\s+/).filter(Boolean).length;

export const LONG_ANSWERS = [
  'relevant_experience', 'scenario_answer', 'challenge_answer',
  'leadership_answer', 'vision_answer',
];

/** Returns `{ field: message }`. Empty object means the form is complete. */
export function validateApplication(f) {
  const e = {};
  for (const [k, label] of Object.entries(REQUIRED)) {
    const v = f[k];
    if (k === 'declaration_accepted') {
      if (!v) e[k] = 'Please confirm the declaration.';
    } else if (!String(v ?? '').trim()) {
      e[k] = `${label} is required.`;
    }
  }
  if (f.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(f.email).trim())) {
    e.email = 'Enter a valid email address.';
  }
  for (const k of LONG_ANSWERS) {
    if (!e[k] && f[k] && words(f[k]) < MIN_WORDS) {
      e[k] = `Please write a little more — at least ${MIN_WORDS} words.`;
    }
  }
  return e;
}

export const wordCount = words;
