import 'server-only';
import { sendNotice } from '@/lib/mailer';
import { meetingIcs } from '@/lib/meetingsEmail';
import { fmtMeetingTime } from '@/lib/meetings';

/* Interview invitations, by email.
 *
 * TWO DIFFERENT LETTERS, deliberately.
 *
 * A candidate and a panellist are being told about the same room at the same
 * time, and almost nothing else about their day is the same. A candidate needs
 * to know they will wait and be called; a panellist needs to know where the
 * scoring screen is. One shared template would have to be vague enough to suit
 * both, which means it tells neither of them what to actually do.
 *
 * Both carry the calendar attachment, because the useful thing an invitation
 * can do is put itself in someone's calendar. And both are pinned to TNR time
 * with the zone named — the mail is composed on a server running in UTC, so an
 * unlabelled clock face is wrong for everybody reading it.
 */

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.mytnr.org';

const LETTERS = {
  candidate: {
    subject: (o, reminder) =>
      `${reminder ? 'Reminder: ' : ''}Interview — ${o?.title || 'TNR'}`,
    heading: (reminder) => reminder
      ? 'Your TNR interview is coming up'
      : 'You are invited to interview',
    lead: (reminder) => reminder
      ? 'A reminder about your interview. The details are below.'
      : 'Your application has reached the interview stage. The panel will meet you '
        + 'in the TNR Virtual Hall.',
    cta: 'Open the meeting',
    link: (m) => `${SITE}/member/meetings/${m.id}`,
    /* WHAT A CANDIDATE ACTUALLY NEEDS TO KNOW.
     *
     * Everyone joins at the same time and waits; they are admitted one at a
     * time. If nobody says that, thirty people sit in a waiting room believing
     * something is broken, and half of them leave. */
    body: () => [
      'How the interview works:',
      '',
      '  • Sign in to the Member Portal and open the meeting at the time below.',
      '  • You will wait in the waiting area until the panel calls you in. This',
      '    is normal — everyone is interviewed one at a time, so there may be a',
      '    wait. Please stay in the waiting area.',
      '  • When it is your turn you will be admitted automatically.',
      '',
      'Before the day, please check that your camera and microphone work, and',
      'join from somewhere quiet with the best signal you can get. If your',
      'connection drops, rejoin — you will return to the waiting area and the',
      'panel will call you again.',
      '',
      'If you cannot attend at this time, reply to this email as soon as you can',
      'so the panel can arrange something else.',
    ].join('\n'),
  },

  panellist: {
    subject: (o, reminder) =>
      `${reminder ? 'Reminder: ' : ''}You are on the interview panel — ${o?.title || 'TNR'}`,
    heading: (reminder) => reminder
      ? 'The interview panel meets soon'
      : 'You have been asked to join an interview panel',
    lead: () => 'You have been assigned to the panel interviewing candidates for '
      + 'this programme.',
    cta: 'Open your panel page',
    link: () => `${SITE}/member/interview-panel`,
    body: (extra) => [
      'What you need to do:',
      '',
      '  • Open the TNR Virtual Hall at the time below to meet the candidates.',
      '  • Keep the Interview Panel page open beside it — that is where you',
      '    record your scores and notes for each candidate.',
      '  • Score each candidate as you finish with them, not at the end of the',
      '    day. You will not remember candidate four by candidate twenty.',
      '',
      "You will not see other panellists' scores for a candidate until you have",
      'saved your own. That is deliberate, so each judgement is independent.',
      '',
      extra?.candidateCount
        ? `There are ${extra.candidateCount} candidates to see. Please allow enough time.`
        : '',
      '',
      'A laptop or tablet works far better than a phone for this, because you',
      'need the meeting and the scoring page open at the same time.',
    ].filter(l => l !== '').join('\n'),
  },
};

/**
 * One invitation or reminder. Never throws — a failed email must not roll back
 * an interview session that was created, and the caller reports how many went.
 *
 * @param {'candidate'|'panellist'} kind
 * @param {boolean} reminder  same details, framed as a reminder
 */
export async function sendInterviewEmail({
  kind, session, meeting, member, opportunity, reminder = false, extra = {},
}) {
  const L = LETTERS[kind];
  if (!L || !member?.email) return { sent: false, skipped: !member?.email };

  const when = meeting?.scheduled_at ? fmtMeetingTime(meeting.scheduled_at) : null;

  const body = [
    `Assalam-o-Alaikum ${member.full_name || 'Member'},`,
    '',
    L.lead(reminder),
    '',
    opportunity?.title ? `Programme: ${opportunity.title}` : '',
    session?.title ? `Panel: ${session.title}` : '',
    when ? `When: ${when}` : 'When: the panel will confirm the time with you.',
    meeting?.duration_minutes ? `Expected length: up to ${meeting.duration_minutes} minutes` : '',
    'Where: TNR Virtual Hall, inside the Member Portal — no other app or account is needed.',
    '',
    L.body(extra),
    '',
    /* The attachment is the only part that can be in the reader's own
     * timezone: the text is written once for everyone, the calendar entry is
     * converted by each person's own device. */
    'If you are outside Pakistan, add the attached calendar entry — it will show '
      + 'in your own local time.',
  ].filter(l => l !== '').join('\n');

  try {
    await sendNotice({
      to: member.email,
      subject: L.subject(opportunity, reminder),
      heading: L.heading(reminder),
      body,
      ctaText: L.cta,
      ctaUrl: L.link(meeting || {}),
      attachments: meeting?.scheduled_at ? [{
        filename: 'tnr-interview.ics',
        content: meetingIcs(
          { ...meeting, title: `${opportunity?.title || 'TNR'} — interview` },
          /* SEQUENCE 1 on a reminder so a calendar treats it as an update to
           * the entry it already holds rather than a second interview. */
          { sequence: reminder ? 1 : 0 },
        ),
        contentType: 'text/calendar; charset=utf-8; method=REQUEST',
      }] : undefined,
    });
    return { sent: true };
  } catch (e) {
    return { sent: false, error: String(e?.message || '').slice(0, 160) };
  }
}

/* How many emails one request sends.
 *
 * Each is an SMTP round trip, one to two seconds against Gmail. Ten fits
 * comfortably inside a 60-second function; thirty-five in one go does not, and
 * a request killed part-way leaves some people emailed, the rest not, and the
 * flag for nobody written. The caller loops. */
export const INTERVIEW_EMAIL_CHUNK = 10;
