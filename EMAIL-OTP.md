# 📧 Email OTP Setup (free)

Voters now log in with their **registered email**; the 6-digit OTP is emailed to them.
It reuses the existing secure flow (hashed OTP, 5-min expiry, one vote per member, vote-token,
audit logs) — nothing about admin/candidates/elections/vote-counting changed.

## 1. Get free SMTP credentials
Any SMTP works. Two easy free options:

**Gmail (App Password)** — simplest for testing / small volume:
1. Turn on 2-Step Verification on your Google account.
2. Google Account → Security → **App passwords** → create one for "Mail".
3. Use:
   - `SMTP_HOST=smtp.gmail.com`
   - `SMTP_PORT=587`
   - `SMTP_USER=your@gmail.com`
   - `SMTP_PASS=<the 16-char app password>`
   - `SMTP_FROM=Tehreek-e-Nojawanan Roundu <your@gmail.com>`

**Brevo / SendGrid** (better deliverability for ~375 emails):
- Sign up (free tier), create an SMTP key, and use their host/port/user/pass.

## 2. Set env vars on Vercel (Production)
```
OTP_PROVIDER=email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=Tehreek-e-Nojawanan Roundu <your@gmail.com>
```
Then **Redeploy**.

## 3. Make sure members have emails
Each voter's row in **Members** needs an **Email** (your import already had emails).
A member with no email can't receive an email OTP — add it in Admin → Members → Edit.

## 4. Test
`/vote` → enter a registered, approved member's **email** → the OTP arrives in their inbox
(check spam the first time) → verify → confirm identity → vote.

## Notes
- Switch anytime with `OTP_PROVIDER` = `email` | `whatsapp` | `twilio` | `meta` | `dev`.
- `dev` shows the code on screen (testing only, no email needed).
- Security already covered by the existing flow: OTP hashed (never stored plain), 5-min expiry,
  one-time use, max 5 attempts, 45s server-side resend cooldown, server-only verification,
  service-role key never exposed, one-vote DB constraint, and audit logging
  (`OTP_SENT`, `OTP_VERIFIED`, `VOTE_SUBMITTED`, `DUPLICATE_VOTE_ATTEMPT`, `OTP_DELIVERY_FAILED`).
- If an email fails to send, the reason is logged in **Admin → Audit Logs** (`OTP_DELIVERY_FAILED`).
