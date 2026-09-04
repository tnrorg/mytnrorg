import 'server-only';
import { sendNotice } from '@/lib/mailer';
import { typeLabel, fmtDateTime, endsAt } from '@/lib/meetings';

/* Meeting invitations, by email.
 *
 * The portal bell already tells a member about a meeting. Email is for the
 * people who do not open the portal daily — which, for a volunteer committee,
 * is most of them. It carries a CALENDAR ATTACHMENT, because the useful thing
 * an invitation can do is put itself in someone's calendar; a message they
 * have to read, remember and act on is a message that gets missed.
 */

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.mytnr.org';

/* An .ics file the mail client will offer to add.
 *
 * Hand-built rather than a dependency: the format is a dozen lines and a
 * library for it would be more surface than the thing itself.
 *
 * METHOD:REQUEST makes Gmail and Outlook show "Yes / Maybe / No" buttons
 * rather than treating it as a plain attachment. UID is stable per meeting, so
 * a re-send UPDATES the existing calendar entry instead of creating a second
 * one — with SEQUENCE bumped when the time changes, which is what tells a
 * calendar this is a revision rather than a duplicate.
 */
export function meetingIcs(meeting, { organiser, sequence = 0 } = {}) {
  const start = new Date(meeting.scheduled_at);
  const end = endsAt(meeting) || new Date(start.getTime() + 3600_000);

  // iCalendar wants UTC as YYYYMMDDTHHMMSSZ.
  const stamp = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

  /* Long lines must be folded at 75 octets and anything structural escaped,
   * or the file is silently rejected by strict clients — an agenda with a
   * comma in it is enough to break it. */
  const esc = (s) => String(s || '')
    .replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');

  const fold = (line) => {
    const out = [];
    let s = line;
    while (s.length > 73) { out.push(`${out.length ? ' ' : ''}${s.slice(0, 73)}`); s = s.slice(73); }
    out.push(`${out.length ? ' ' : ''}${s}`);
    return out.join('\r\n');
  };

  const url = `${SITE}/member/meetings/${meeting.id}`;
  const description = [
    meeting.description,
    meeting.agenda ? `Agenda:\n${meeting.agenda}` : '',
    `Join from the TNR Virtual Hall: ${url}`,
  ].filter(Boolean).join('\n\n');

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Tehreek-e-Nojawanan Roundu//TNR Virtual Hall//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:tnr-meeting-${meeting.id}@mytnr.org`,
    `SEQUENCE:${Number(sequence) || 0}`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    fold(`SUMMARY:${esc(meeting.title)}`),
    fold(`DESCRIPTION:${esc(description)}`),
    fold(`LOCATION:${esc('TNR Virtual Hall — ' + url)}`),
    fold(`URL:${esc(url)}`),
    ...(organiser?.email
      ? [fold(`ORGANIZER;CN=${esc(organiser.full_name || 'TNR')}:mailto:${organiser.email}`)]
      : []),
    'STATUS:CONFIRMED',
    // A reminder an hour before, set by the calendar rather than by us — it
    // fires on the member's own device even if nobody opens the site.
    'BEGIN:VALARM',
    'TRIGGER:-PT1H',
    'ACTION:DISPLAY',
    fold(`DESCRIPTION:${esc(meeting.title)} starts in one hour`),
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  return `${lines.join('\r\n')}\r\n`;
}

/* Cancellations get their own .ics so the entry is REMOVED from the calendar
 * rather than sitting there for a meeting that is not happening. */
export function cancelIcs(meeting, opts = {}) {
  return meetingIcs(meeting, { ...opts, sequence: (opts.sequence || 0) + 1 })
    .replace('METHOD:REQUEST', 'METHOD:CANCEL')
    .replace('STATUS:CONFIRMED', 'STATUS:CANCELLED');
}

const KINDS = {
  created: {
    subject: (m) => `Invitation: ${m.title}`,
    heading: 'You are invited to a TNR meeting',
    lead: 'You have been invited to the following meeting. The calendar entry is attached.',
    cta: 'Open in the Member Portal',
  },
  rescheduled: {
    subject: (m) => `Rescheduled: ${m.title}`,
    heading: 'A meeting has been rescheduled',
    lead: 'This meeting has moved. The updated calendar entry is attached and will replace the old one.',
    cta: 'View the new time',
  },
  cancelled: {
    subject: (m) => `Cancelled: ${m.title}`,
    heading: 'A meeting has been cancelled',
    lead: 'This meeting will not take place. It has been removed from your calendar.',
    cta: 'Open My Meetings',
  },
  reminder: {
    subject: (m) => `Starting soon: ${m.title}`,
    heading: 'Your meeting starts in about an hour',
    lead: 'A reminder about the meeting below.',
    cta: 'Join from the portal',
  },
};

/**
 * One invitation. Never throws — a failed email must not roll back a meeting
 * that was created, and the caller reports how many actually went.
 */
export async function sendMeetingEmail({ kind, meeting, member, host }) {
  const k = KINDS[kind];
  if (!k || !member?.email) return { sent: false, skipped: !member?.email };

  const when = fmtDateTime(meeting.scheduled_at);
  const body = [
    `Assalam-o-Alaikum ${member.full_name || 'Member'},`,
    '',
    k.lead,
    '',
    `Meeting: ${meeting.title}`,
    `Type: ${typeLabel(meeting.meeting_type)}`,
    `When: ${when}`,
    `Duration: ${meeting.duration_minutes} minutes`,
    host?.full_name ? `Host: ${host.full_name}` : '',
    meeting.agenda ? `\nAgenda:\n${meeting.agenda}` : '',
    kind === 'cancelled' && meeting.cancelled_reason ? `\nReason: ${meeting.cancelled_reason}` : '',
    '',
    kind === 'cancelled'
      ? 'No action is needed.'
      : 'The meeting takes place in the TNR Virtual Hall, inside the Member Portal — '
        + 'you do not need any other account or app.',
  ].filter(l => l !== undefined).join('\n');

  try {
    await sendNotice({
      to: member.email,
      subject: k.subject(meeting),
      heading: k.heading,
      body,
      ctaText: k.cta,
      ctaUrl: `${SITE}/member/meetings/${meeting.id}`,
      /* No calendar file on a reminder — the entry is already in their
       * calendar from the invitation, and a second one an hour before would
       * either duplicate it or look like a change. */
      attachments: kind === 'reminder' ? undefined : [{
        filename: 'tnr-meeting.ics',
        content: kind === 'cancelled' ? cancelIcs(meeting, { organiser: host })
          : meetingIcs(meeting, { organiser: host, sequence: kind === 'rescheduled' ? 1 : 0 }),
        contentType: `text/calendar; charset=utf-8; method=${kind === 'cancelled' ? 'CANCEL' : 'REQUEST'}`,
      }],
    });
    return { sent: true };
  } catch (e) {
    return { sent: false, error: String(e?.message || '').slice(0, 160) };
  }
}

/* How many invitations one request sends.
 *
 * Each is an SMTP round trip. Twenty-five is comfortably inside the serverless
 * time limit; a full membership of 293 is not, which is why the caller loops
 * in chunks and reports progress rather than trying it in one go and timing
 * out halfway with nobody knowing who was reached. */
export const EMAIL_CHUNK = 25;
