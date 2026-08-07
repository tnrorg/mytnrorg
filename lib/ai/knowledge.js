import {
  WHO_WE_ARE, WHAT_WE_DO, VISION, MISSION, MOTTO, CORE_VALUES, GUIDING_PRINCIPLES,
  GOVERNANCE_TIERS, ADC_INTRO, ADC_DUTIES, ADC_FACTS, CEC_ROLE, CEC_POSITIONS,
  CORE_LEADERSHIP_CRITERIA, CONDUCT_STANDARDS, DISCIPLINARY_MEASURES, HANDBOOK,
} from '@/content/aboutTnr';

/**
 * TNR knowledge base.
 *
 * Answers are drawn from the Governance Handbook and the live membership data —
 * nothing is generated. That is deliberate: an assistant on an official site
 * must not invent facts about the organisation, so if a question is not covered
 * here it says so and points at a page or a human instead of guessing.
 */

const first = (v, n = 2) => (Array.isArray(v) ? v.slice(0, n).join(' ') : String(v || ''));
const bullets = (v, n = 6) =>
  (Array.isArray(v) ? v : []).slice(0, n)
    .map(x => `• ${typeof x === 'string' ? x : (x.title || x.name || x.label || '')}`)
    .join('\n');

export const ENTRIES = [
  {
    id: 'what-is-tnr',
    q: ['what is tnr', 'about tnr', 'who are you', 'tehreek', 'nojawanan', 'organisation', 'organization'],
    answer: () => first(WHO_WE_ARE, 2),
    links: [['About TNR', '/about']],
  },
  {
    id: 'what-we-do',
    q: ['what do you do', 'activities', 'work', 'programs', 'programmes', 'core areas', 'initiatives'],
    answer: () => first(WHAT_WE_DO, 2),
    links: [['About TNR', '/about']],
  },
  {
    id: 'vision-mission',
    q: ['vision', 'mission', 'aim', 'purpose', 'goal', 'objective', 'motto'],
    answer: () => `Vision — ${first(VISION, 1)}\n\nMission — ${first(MISSION, 1)}` +
      (MOTTO ? `\n\nMotto — ${first(MOTTO, 1)}` : ''),
    links: [['Vision & Mission', '/about/vision-mission']],
  },
  {
    id: 'values',
    q: ['values', 'core values', 'principles', 'guiding'],
    answer: () => bullets(CORE_VALUES.length ? CORE_VALUES : GUIDING_PRINCIPLES, 8),
    links: [['About TNR', '/about']],
  },
  {
    id: 'join',
    q: ['join', 'become a member', 'apply', 'membership', 'register', 'sign up', 'how to join'],
    answer: () =>
      'Anyone from Roundu who supports the aims of TNR can apply for membership.\n\n' +
      'The form asks for your personal details, education and profession, why you want to join, ' +
      'and the areas you would like to contribute to. It takes about five minutes and saves as you go.\n\n' +
      'Applications are reviewed by the membership committee. You will receive a reference number ' +
      'on submission — keep it, as it becomes your membership number once approved.',
    links: [['Apply for Membership', '/membership/apply'], ['Membership Overview', '/membership']],
  },
  {
    id: 'application-status',
    q: ['status', 'check application', 'reference number', 'how long', 'approved yet', 'pending'],
    answer: () =>
      'You can check your application at any time using the reference number you received ' +
      '(it looks like TNR-MN-0001) together with the email address you applied with.\n\n' +
      'Applications are reviewed by the membership committee. You will be emailed when the outcome is decided.',
    links: [['Check Application Status', '/membership/status']],
  },
  {
    id: 'membership-types',
    q: ['type of membership', 'categories', 'general member', 'uc team', 'which type', 'membership type'],
    answer: () =>
      'There are four membership types, chosen at the top of the application form:\n\n' +
      '• General Member — open to every young person of Roundu\n' +
      '• Union Council Team — volunteers coordinating activity in a Union Council\n' +
      '• Central Executive Committee — office bearers of the central body\n' +
      '• Advisory Council — senior professionals and academics advising TNR\n\n' +
      'Choose the last three only if you already hold that position; otherwise select General Member. ' +
      'The committee confirms the final role at approval.',
    links: [['Apply for Membership', '/membership/apply']],
  },
  {
    id: 'benefits',
    q: ['benefit', 'why join', 'what do i get', 'advantage', 'membership card', 'certificate'],
    answer: () =>
      'Members receive a digital membership card and certificate, and access to the Member Portal, ' +
      'which includes a CV builder, cover letter builder, documents and certificates, ' +
      'opportunities, events and volunteer activities.',
    links: [['Membership Overview', '/membership'], ['Member Login', '/member/login']],
  },
  {
    id: 'advisory-council',
    q: ['advisory council', 'adc', 'advisors', 'senior leadership'],
    answer: () => first(ADC_INTRO, 2) ||
      'The Advisory Council is the strategic advisory and oversight body of TNR.',
    links: [['Advisory Council', '/about/advisory-council']],
  },
  {
    id: 'executive-committee',
    q: ['executive committee', 'cec', 'president', 'office bearers', 'leadership', 'secretary'],
    answer: () => first(CEC_ROLE, 2) ||
      'The Central Executive Committee is the principal executive body of TNR.',
    links: [['Executive Committee', '/about/executive-committee'], ['Office Bearers', '/about/office-bearers']],
  },
  {
    id: 'governance',
    q: ['governance', 'structure', 'how is tnr run', 'tiers', 'constitution', 'rules'],
    answer: () =>
      'TNR is governed under its Constitution, with the following tiers:\n\n' + bullets(GOVERNANCE_TIERS, 8),
    links: [['Governance Structure', '/about/governance'], ['Constitution', '/about/constitution']],
  },
  {
    id: 'conduct',
    q: ['code of conduct', 'discipline', 'behaviour', 'behavior', 'complaint', 'misconduct'],
    answer: () =>
      'All members are bound by the TNR Code of Conduct. Key standards:\n\n' + bullets(CONDUCT_STANDARDS, 5),
    links: [['Code of Conduct', '/about/code-of-conduct']],
  },
  {
    id: 'election',
    q: ['election', 'vote', 'voting', 'ballot', 'candidate', 'result'],
    answer: () =>
      'TNR runs its elections through the Election Portal, where you can find the current election, ' +
      'candidate information, voter verification and published results.',
    links: [['Election Portal', '/election-portal'], ['Results', '/results']],
  },
  {
    id: 'eligibility-leadership',
    q: ['eligibility', 'criteria', 'qualify', 'requirements', 'who can stand'],
    answer: () =>
      'Core criteria for TNR leadership positions:\n\n' + bullets(CORE_LEADERSHIP_CRITERIA, 6),
    links: [['Office Bearers', '/about/office-bearers'], ['Constitution', '/about/constitution']],
  },
  {
    id: 'contact',
    q: ['contact', 'email', 'phone', 'reach', 'support', 'help', 'talk to someone'],
    answer: () =>
      'For anything this assistant cannot answer, please use the Help Centre or contact the ' +
      'membership committee. Members can also raise a request from the Support section of the Member Portal.',
    links: [['Member Login', '/member/login'], ['Membership Overview', '/membership']],
  },
];

/** Questions worth offering up front. */
export const SUGGESTIONS = [
  'How do I join TNR?',
  'What is TNR?',
  'What are the membership types?',
  'How many members does TNR have?',
  'What is the Advisory Council?',
  'Where do I check my application status?',
];

export const HANDBOOK_REF = HANDBOOK;
