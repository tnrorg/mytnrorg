import 'server-only';
import { sendNotice } from '@/lib/mailer';

/* Applicant emails for the four admin decisions.
 *
 * Uses sendNotice from lib/mailer — the SAME transport, from-address and TNR
 * branding as every other email the site sends. No second SMTP configuration
 * is created here: a separate mail path is a separate thing to misconfigure,
 * and the day it breaks nobody remembers it exists.
 *
 * Wording matters more than usual. These land in the inbox of a young person
 * who asked their community for an opportunity, so the rejection is written to
 * be read by someone who will be disappointed — appreciative, specific about
 * what happens next, and free of the language of failure.
 */

const first = (name) => String(name || '').trim().split(/\s+/)[0] || 'there';

export const TEMPLATES = {
  shortlisted: (m, o) => ({
    subject: `${o.title} — Application Shortlisted`,
    heading: 'Your application has been shortlisted',
    body:
`Assalam-o-Alaikum ${first(m.full_name)},

Thank you for applying to the ${o.title}.

We are pleased to let you know that your application has been shortlisted for the next stage of the selection process.

The committee will be in touch with further information shortly. There is nothing you need to do at this point — please keep an eye on your email and your TNR member portal.

Thank you for the interest you have shown in this programme.

Tehreek-e-Nojawanan Roundu`,
  }),

  interview_invited: (m, o, interview = {}) => ({
    subject: `${o.title} — Interview Invitation`,
    heading: 'You are invited to an interview',
    body:
`Assalam-o-Alaikum ${first(m.full_name)},

Following the review of your application to the ${o.title}, we would like to invite you to an interview.

${[
  interview.date ? `Date: ${interview.date}` : null,
  interview.time ? `Time: ${interview.time}` : null,
  interview.mode ? `Mode: ${interview.mode}` : null,
  interview.venue ? `${/online|phone|whatsapp/i.test(interview.mode || '') ? 'Meeting link' : 'Venue'}: ${interview.venue}` : null,
].filter(Boolean).join('\n')}
${interview.notes ? `\n${interview.notes}\n` : ''}
If this time is difficult for you, please reply to this email and we will do our best to accommodate you.

We look forward to speaking with you.

Tehreek-e-Nojawanan Roundu`,
  }),

  selected: (m, o) => ({
    subject: `Congratulations — ${o.title}`,
    heading: 'Congratulations',
    body:
`Assalam-o-Alaikum ${first(m.full_name)},

We are delighted to inform you that you have been selected for the ${o.title}.

Congratulations. Your application stood out, and we are glad to have you join this programme.

Details of the onboarding and the programme schedule will be shared with you shortly, both by email and in your TNR member portal.

Welcome aboard.

Tehreek-e-Nojawanan Roundu`,
  }),

  rejected: (m, o) => ({
    subject: `${o.title} — Application Update`,
    heading: 'An update on your application',
    body:
`Assalam-o-Alaikum ${first(m.full_name)},

Thank you for applying to the ${o.title}, and for the time you put into your application.

On this occasion we are not able to offer you a place. The number of applications was high and the committee had far fewer places than deserving candidates, which made the decision a genuinely difficult one.

Please do not read this as a reflection on your ability. We would very much encourage you to apply for future TNR opportunities — they are announced in your member portal, and your membership remains active and welcome.

With thanks and best wishes,

Tehreek-e-Nojawanan Roundu`,
  }),
};

/**
 * Send the email for a status change.
 * @returns {{sent:boolean, error?:string}} — never throws.
 */
export async function sendApplicationEmail({ status, member, opportunity, interview }) {
  const make = TEMPLATES[status];
  // 'submitted' and 'withdrawn' have no applicant email, by design.
  if (!make) return { sent: false, error: null, skipped: true };

  const to = String(member?.email || '').trim();
  if (!to.includes('@')) return { sent: false, error: 'No email address on this member record.' };

  try {
    const { subject, heading, body } = make(member, opportunity, interview || {});
    await sendNotice({
      to, subject, heading, body,
      ctaText: 'Open Member Portal',
      ctaUrl: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://www.mytnr.org'}/member/opportunities`,
    });
    return { sent: true };
  } catch (e) {
    /* Reported, never thrown.
     *
     * The status change is already committed by the time this runs. Throwing
     * would roll the caller into an error path and tempt an admin to click the
     * action again — which would change nothing but would send a second email
     * if the first had in fact gone out. */
    return { sent: false, error: e?.message || 'Email failed to send.' };
  }
}
