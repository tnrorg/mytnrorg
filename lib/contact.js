/* Shared shape and rules for the contact forms.
 *
 * Imported by BOTH the form and the API route, so the browser's instant
 * feedback and the server's enforcement cannot drift apart — the same
 * arrangement the membership and CEC applications use.
 */

export const KINDS = [
  {
    key: 'general',
    label: 'Contact Us',
    heading: 'Contact TNR',
    lead: 'Questions about membership, our work, or anything else — send us a message and we will reply.',
    subjectLabel: 'What is this about?',
  },
  {
    key: 'feedback',
    label: 'Feedback',
    heading: 'Share Your Feedback',
    lead: 'Ideas for what TNR should do differently, or something that worked well and should continue. We read every message.',
    subjectLabel: 'What is your feedback about?',
  },
  {
    key: 'complaint',
    label: 'Complaints',
    heading: 'Make a Complaint',
    lead: 'If something has gone wrong — how you were treated, a decision you believe was unfair, or conduct that falls short of our Code of Conduct — tell us here.',
    subjectLabel: 'What is your complaint about?',
  },
  {
    key: 'support',
    label: 'Technical Support',
    heading: 'Technical Support',
    lead: 'Trouble signing in, a page that will not load, a problem with your membership card or CV. Tell us what happened and what you expected.',
    subjectLabel: 'What is the problem?',
  },
];

export const KIND_KEYS = KINDS.map(k => k.key);
export const kindByKey = (key) => KINDS.find(k => k.key === key) || KINDS[0];
export const kindLabel = (key) => kindByKey(key).label;

export const STATUSES = ['new', 'read', 'resolved', 'spam'];
export const STATUS_LABEL = {
  new: 'New', read: 'Read', resolved: 'Resolved', spam: 'Spam',
};

/* Length caps.
 *
 * Generous, but present. This endpoint is public: without a ceiling, one
 * request could write a megabyte of text into the table, and enough of them
 * would fill the free-tier database. The message limit is long enough to set
 * out a complaint properly.
 */
export const LIMITS = {
  name: 120,
  email: 160,
  mobile: 40,
  membership_id: 40,
  subject: 200,
  message: 5000,
};

const MIN_MESSAGE_WORDS = 5;
const words = (s) => String(s || '').trim().split(/\s+/).filter(Boolean).length;

export function validateContact(f = {}) {
  const e = {};
  const str = (k) => String(f[k] ?? '').trim();

  if (!KIND_KEYS.includes(f.kind)) e.kind = 'Unknown form.';
  if (!str('name')) e.name = 'Your name is required.';

  /* One of email or mobile, not both.
   *
   * Demanding both turns people away who have only one; demanding neither
   * means a message nobody can reply to, which wastes the sender's time more
   * than ours. */
  if (!str('email') && !str('mobile')) {
    e.email = 'Give an email address or a phone number so we can reply.';
  }
  if (str('email') && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(str('email'))) {
    e.email = 'Enter a valid email address.';
  }

  if (!str('subject')) e.subject = 'A short subject is required.';

  if (!str('message')) e.message = 'Please write your message.';
  else if (words(str('message')) < MIN_MESSAGE_WORDS) {
    e.message = 'Please give us a little more detail.';
  }

  for (const [k, max] of Object.entries(LIMITS)) {
    if (str(k).length > max) e[k] = `Please keep this under ${max} characters.`;
  }

  return e;
}
