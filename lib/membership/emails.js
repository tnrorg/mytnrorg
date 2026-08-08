// Membership emails — reuse the existing branded SMTP sender (lib/mailer.js).
// No new credentials, no secrets in the client bundle.
import { sendNotice } from '@/lib/mailer';

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL || 'https://tnr-nine.vercel.app';

export async function sendApplicationReceived(app) {
  await sendNotice({
    to: app.email,
    subject: `Application Received — ${app.reference_no}`,
    heading: 'We have received your application',
    body:
`Assalam-o-Alaikum Dear ${app.first_name},

Thank you for applying for membership of Tehreek-e-Naujawanan Roundu.

Your application reference number is: ${app.reference_no}

Please keep this number safe. You can check your application status at any time
using this reference number and your email address.

Our membership committee will review your application and inform you of the outcome.

TNR Membership Committee`,
    ctaText: 'Check Application Status',
    ctaUrl: `${siteUrl()}/membership/status`,
  });
}

/** Alerts the membership committee that a new application has arrived.
 *  This was missing entirely: applicants were emailed a confirmation, but
 *  nobody on the admin side was told, so applications sat unnoticed in the
 *  Pending queue until someone happened to look.
 *
 *  Recipients come from ADMIN_NOTIFY_EMAIL (comma-separated). If that is not
 *  set it falls back to SMTP_FROM, so the alert still lands somewhere. */
export async function sendAdminNewApplication(app, roleLabel) {
  const to = (process.env.ADMIN_NOTIFY_EMAIL || process.env.SMTP_FROM || '')
    .split(',').map(x => x.trim()).filter(Boolean);
  if (!to.length) return;                       // nothing configured — skip quietly

  const name = [app.first_name, app.last_name].filter(Boolean).join(' ');
  await sendNotice({
    to: to.join(','),
    subject: `New membership application — ${name} (${app.reference_no})`,
    heading: 'New membership application',
    body:
`A new application has been submitted and is waiting for review.

Reference:       ${app.reference_no}
Name:            ${name}
Membership type: ${roleLabel || 'General Member'}
Union Council:   ${app.union_council || '—'}
Village / Area:  ${app.village || '—'}
Email:           ${app.email}
Mobile:          ${app.mobile || '—'}
Profession:      ${app.current_position || '—'}

Open the admin panel to review, approve or request corrections.`,
    ctaText: 'Review in Admin Panel',
    ctaUrl: `${siteUrl()}/admin`,
  });
}

/**
 * Approval email.
 *
 * Applicants now choose their password on the form, so most members simply
 * need telling that they are approved and can sign in. The set-password link
 * is only sent when no password came across — an application submitted before
 * that field existed, or an account created directly by an admin.
 */
export async function sendApprovalInvite(member, inviteToken) {
  const hasPassword = !!member.password_hash;

  if (hasPassword) {
    await sendNotice({
      to: member.email,
      subject: 'Your TNR Membership is Approved',
      heading: 'Welcome to Tehreek-e-Naujawanan Roundu',
      body:
`Assalam-o-Alaikum Dear ${member.first_name},

Congratulations — your membership application has been approved.

Your Membership ID is: ${member.membership_id}

You can sign in to the Member Portal straight away using your email address
and the password you chose when you applied. No further setup is needed.

Through the Member Portal you can manage your profile, build your CV,
download your digital membership card and certificate, and access
opportunities, events and community programmes.

If you have forgotten your password, use "Forgot password" on the sign-in page.

TNR Membership Committee`,
      ctaText: 'Sign In',
      ctaUrl: `${siteUrl()}/member/login`,
    });
    return;
  }

  await sendNotice({
    to: member.email,
    subject: 'Your TNR Membership is Approved — Set Your Password',
    heading: 'Welcome to Tehreek-e-Naujawanan Roundu',
    body:
`Assalam-o-Alaikum Dear ${member.first_name},

Congratulations — your membership application has been approved.

Your Membership ID is: ${member.membership_id}

To activate your Member Portal, please set your password using the button below.
This link is valid for 7 days and can be used once.

Through the Member Portal you can manage your profile, build your CV,
download your digital membership card and certificate, and access
opportunities, events and community programmes.

TNR Membership Committee`,
    ctaText: 'Set My Password',
    ctaUrl: `${siteUrl()}/member/set-password?token=${inviteToken}`,
  });
}

export async function sendRejection(app, reason) {
  await sendNotice({
    to: app.email,
    subject: `Membership Application Update — ${app.reference_no}`,
    heading: 'Application Update',
    body:
`Assalam-o-Alaikum Dear ${app.first_name},

Thank you for your interest in Tehreek-e-Naujawanan Roundu.

After review, your membership application (${app.reference_no}) has not been approved at this time.

${reason ? 'Reason: ' + reason : ''}

You are welcome to contact the membership committee if you would like further guidance.

TNR Membership Committee`,
  });
}

export async function sendPasswordReset(member, token) {
  await sendNotice({
    to: member.email,
    subject: 'Reset Your TNR Member Password',
    heading: 'Password Reset Request',
    body:
`Assalam-o-Alaikum Dear ${member.first_name},

We received a request to reset the password for your TNR Member Portal account.

Use the button below to set a new password. This link is valid for 7 days.
If you did not request this, you can safely ignore this email.

TNR Membership Committee`,
    ctaText: 'Reset My Password',
    ctaUrl: `${siteUrl()}/member/set-password?token=${token}`,
  });
}
