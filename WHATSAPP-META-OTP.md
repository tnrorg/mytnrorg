# 📲 Meta WhatsApp Cloud API — OTP Setup

This integrates **Meta's official WhatsApp Cloud API** for voter OTP, with **no changes** to the
existing UI, database, election logic, or voting flow. It plugs into the existing OTP provider
switch — flip one env var and every OTP goes through Meta.

## How it fits the existing flow (unchanged)
```
/vote → enter WhatsApp number → request-otp (validates: registered, approved, on locked list,
        election active, not already voted) → 6-digit OTP hashed + stored (5-min expiry, one-time,
        max 5 attempts) → sent via Meta Cloud API → verify-otp → signed vote token → cast vote
```
Audit logs (`OTP_SENT`, `OTP_VERIFIED`, `VOTE_SUBMITTED`, `DUPLICATE_VOTE_ATTEMPT`) already fire — untouched.

---

## 1. Create the WhatsApp app + get credentials
1. Go to **developers.facebook.com** → your App (or create one) → add the **WhatsApp** product.
2. **WhatsApp → API Setup** gives you:
   - **Temporary access token** (24h) — for testing. For production create a **permanent** token
     (Business Settings → System Users → generate token with `whatsapp_business_messaging`).
   - **Phone number ID**
   - **WhatsApp Business Account ID**
3. Add and verify your business phone number (or use the test number for development).

## 2. Create an APPROVED message template
Meta requires a pre-approved template to send OTPs.
- **WhatsApp Manager → Message Templates → Create template**
- Category: **Authentication** (recommended) — Meta auto-formats the code + copy button.
- Language: **English** (or your choice), note the language code (e.g. `en`).
- Name it e.g. `otp_verification`.

Sample content the template produces:
```
TEHREEK-E-NOJAWANAN ROUNDU
Your Election Verification Code is: 482913
This code will expire in 5 minutes. Do not share this code with anyone.
```
Wait for Meta to mark it **Approved** before sending.

## 3. Set environment variables (Vercel → Settings → Environment Variables)
```
OTP_PROVIDER=meta
META_WA_TOKEN=<permanent access token>
META_WA_PHONE_NUMBER_ID=<phone number id>
META_WA_BUSINESS_ACCOUNT_ID=<business account id>
META_WA_API_VERSION=v21.0
META_WA_TEMPLATE_NAME=otp_verification
META_WA_TEMPLATE_LANG=en
META_WA_TEMPLATE_HAS_BUTTON=true      # set false if your template has NO copy-code button
DEFAULT_COUNTRY_CODE=92
```
Then **Redeploy**. (Also add them to `.env.local` for local testing.)

## 4. Switch providers any time
`OTP_PROVIDER` controls delivery — no code change needed:
- `meta` → Meta WhatsApp Cloud API (this guide) ✅
- `whatsapp` → self-hosted WhatsApp service (Baileys)
- `twilio` → Twilio SMS/WhatsApp
- `dev` → no send; code shown on screen (local testing only)

---

## Security (already enforced by the existing flow)
- OTP is **hashed** (HMAC-SHA256), never stored in plain text.
- 6-digit numeric, **5-minute** expiry, **one-time use**, **max 5 attempts**.
- Verification is **server-side only** (`/api/vote/verify-otp`); the frontend never verifies.
- Only **approved, eligible, locked-list** voters can request an OTP; unregistered numbers are rejected.
- Credentials live in **environment variables only** — never sent to the client.
- Resend has a **60-second cooldown** (built into the OTP screen).

## Troubleshooting
- **"WhatsApp API error: (#132001) template does not exist"** → template name/lang doesn't match, or not yet Approved. Check `META_WA_TEMPLATE_NAME` / `META_WA_TEMPLATE_LANG`.
- **"(#131030) recipient not in allowed list"** → in dev, add the tester number in WhatsApp → API Setup, or move the number out of sandbox.
- **Button param error** → your template has no copy-code button; set `META_WA_TEMPLATE_HAS_BUTTON=false`.
- **Token expired** → the temporary token lasts 24h; use a permanent System-User token for production.

## Files
- `lib/whatsappMeta.js` — the Meta Cloud API sender (new).
- `lib/otpSender.js` — provider switch; `meta` branch added.
- Everything else unchanged.
