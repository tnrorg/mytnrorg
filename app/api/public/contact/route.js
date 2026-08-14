import { supabaseAdmin } from '@/lib/supabaseServer';
import { ok, fail, readJson } from '@/lib/api';
import { clientIp } from '@/lib/audit';
import { throttle, lockoutMessage } from '@/lib/loginGuard';
import { validateContact, LIMITS, kindByKey } from '@/lib/contact';
import { sendNotice } from '@/lib/mailer';

export const dynamic = 'force-dynamic';

/* Public contact / feedback / complaint / support endpoint.
 *
 * ORDER MATTERS: the message is written to the database FIRST, and the email
 * notification attempted afterwards. Email here is a convenience, not the
 * record — a full mailbox, an SMTP hiccup or the Gmail daily quota running out
 * must never be the reason a complaint disappears. If the insert fails the
 * sender is told plainly and can try again; if only the email fails, the
 * message is safely stored and the sender is not troubled with it.
 */
export async function POST(req) {
  const b = await readJson(req);
  const ip = clientIp(req);

  /* Unauthenticated and public, so it needs a limit or it is a spam cannon —
   * both at this table and at the mailbox it notifies. Five in fifteen minutes
   * is far above what a person writing a real message needs. */
  const gate = await throttle('contact', ip, { max: 5, windowMinutes: 15, lockMinutes: 30 });
  if (gate.blocked) {
    return fail('RATE_LIMITED', 429, { message: lockoutMessage(gate.retryAfter) });
  }

  const errors = validateContact(b);
  if (Object.keys(errors).length) {
    return fail('INVALID', 400, { errors, message: 'Please check the highlighted fields.' });
  }

  const clip = (k) => String(b[k] ?? '').trim().slice(0, LIMITS[k]);

  const row = {
    kind: b.kind,
    name: clip('name'),
    email: clip('email').toLowerCase(),
    mobile: clip('mobile'),
    membership_id: clip('membership_id').toUpperCase(),
    subject: clip('subject'),
    message: clip('message'),
    ip,
    user_agent: String(req.headers.get('user-agent') || '').slice(0, 300),
  };

  const { data, error } = await supabaseAdmin()
    .from('contact_messages').insert(row).select('id').maybeSingle();

  if (error) {
    console.error('[contact] insert failed:', error.message);
    return fail('SAVE_FAILED', 500, {
      message: 'Your message could not be saved. Please try again, or email us directly.',
      // Named rather than generic: this exact error is what an un-run
      // migration looks like, and the fix is one file.
      hint: 'Administrator: run supabase/migration_contact_messages.sql.',
    });
  }

  // Notification only. Failure is logged and swallowed — the message is
  // already safe, and telling the sender it failed would invite a duplicate.
  try {
    const kind = kindByKey(row.kind);
    const to = process.env.CONTACT_NOTIFY_TO || process.env.SMTP_USER;
    if (to) {
      await sendNotice({
        to,
        subject: `[TNR ${kind.label}] ${row.subject}`,
        heading: `New ${kind.label.toLowerCase()} message`,
        body:
          `From: ${row.name}\n` +
          `Email: ${row.email || '—'}\n` +
          `Phone: ${row.mobile || '—'}\n` +
          `Membership ID: ${row.membership_id || '—'}\n\n` +
          `Subject: ${row.subject}\n\n${row.message}`,
        ctaText: 'Open the admin inbox',
        ctaUrl: 'https://www.mytnr.org/admin',
      });
    }
  } catch (e) {
    console.error('[contact] notification email failed:', e.message);
  }

  return ok({ id: data?.id, received: true });
}
