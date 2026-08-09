# TNR Digital Platform — Internal Security Audit

**Scope:** application code at commit `f0eeb1a`, Supabase schema and migrations, deployment configuration.
**Method:** authorised static review. No exploitation was performed against production, no member data was read or exported, and no destructive command was run.

---

## 1. Executive summary

**Overall status: HIGH RISK** — driven by a single finding.

The application's authorisation architecture is sound. All 65 admin API routes and all 20 non-public member routes carry a server-side guard; role checks are enforced in the API rather than the UI; member-owned rows are scoped by `member_id` in 35 places; RLS is enabled on ~70 tables with no permissive policies on anything sensitive.

That work is undermined by one thing: **the JWT signing secret had a hardcoded fallback published in a public GitHub repository.** If `JWT_SECRET` is unset on the deployment, every other control is bypassable by anyone on the internet — no login, no brute force, and nothing in the audit log to distinguish the session from a real administrator.

Rating is HIGH rather than CRITICAL because whether the fallback was ever *live* depends on a deployment variable this review could not read. **That is the first thing to check** (§4).

---

## 2. Findings

### TNR-SEC-001 — Hardcoded JWT fallback secret in a public repository
- **Severity:** CRITICAL
- **Component:** `lib/auth.js`, `lib/membership/auth.js`, `lib/otp.js`, `lib/voteToken.js`
- **Description:** Four modules used `process.env.JWT_SECRET || 'tnr_secret'`. The repository `tnrorg/mytnrorg` was **public** at the time of the audit (verified: `repository_public: true`) and has since been made private (re-verified). The literal was therefore readable by anyone for the project's lifetime up to that point.
- **Impact:** With `JWT_SECRET` unset, an attacker reads the literal from the repo and signs `{ sub, username, role: 'super_admin' }`. That yields full admin access to 375 member records, election data, and identity documents. The same secret keys OTP hashes — so every six-digit code could be precomputed — and vote tokens.
- **Evidence:** `lib/auth.js:5` (before fix); GitHub metadata confirming public visibility.
- **Fix:** New `lib/jwtSecret.js`. Production **throws on boot** if the secret is missing or under 32 characters; development uses a random per-process value. No shared literal remains.
- **Status:** FIXED IN CODE — **rotation still required** (§4).

### TNR-SEC-002 — No security headers
- **Severity:** HIGH
- **Component:** `next.config.js`
- **Impact:** No clickjacking protection (admin panel framable); no HSTS; default `Referrer-Policy` leaked full URLs cross-site — including `/member/set-password?token=…`, so a reset token could reach any third-party site a member clicked through to.
- **Fix:** Added `X-Frame-Options`, `frame-ancestors 'self'`, `nosniff`, `strict-origin-when-cross-origin`, `Permissions-Policy`, HSTS (2y, preload), `no-store` on `/api/*`, `noindex` on `/admin/*` and `/member/*`.
- **Status:** FIXED

### TNR-SEC-003 — Default admin credentials published
- **Severity:** HIGH
- **Component:** `README.md`, `components/admin/Login.js`, `supabase/seed.sql`
- **Impact:** `admin / admin123` was printed in the public README **and rendered on the live `/admin` login page**. Anyone who visited the admin URL was shown a working credential pair.
- **Fix:** Removed from the login page (earlier this session) and from the README. Seed file carries a warning.
- **Status:** FIXED IN CODE — **password rotation required** (§4).

### TNR-SEC-004 — Unthrottled password reset and registration
- **Severity:** MEDIUM
- **Component:** `app/api/member/forgot-password`, `app/api/public/membership/apply`
- **Impact:** Either endpoint could be called in a loop: flood a member's inbox, exhaust the 500/day Gmail quota so genuine OTPs stop arriving, or fill the committee queue with spam applications.
- **Fix:** Generic `throttle()` added to `lib/loginGuard.js`. Reset: 5/IP/15min. Registration: 3/IP/hour.
- **Status:** FIXED

### TNR-SEC-005 — Database errors returned to unauthenticated callers
- **Severity:** MEDIUM
- **Component:** three public routes
- **Impact:** Raw Postgres messages name tables, columns and constraints, giving an attacker a free schema map.
- **Fix:** `detail` removed from all public error responses. Admin routes retain it — those callers are authenticated and need it to diagnose migrations.
- **Status:** FIXED

### TNR-SEC-006 — Image optimiser accepted any remote host
- **Severity:** MEDIUM
- **Component:** `next.config.js` — `remotePatterns: hostname: '**'`
- **Impact:** SSRF primitive: `/_next/image?url=https://any-host/...` made your server fetch arbitrary URLs and serve the bytes from your domain.
- **Fix:** Narrowed to Cloudinary, Supabase, and the two TNR hostnames.
- **Status:** FIXED

### TNR-SEC-007 — Privilege granted from applicant-supplied input
- **Severity:** HIGH
- **Component:** `app/api/admin/membership/applications/[id]` (fixed earlier this session)
- **Impact:** Approval defaulted to the applicant's self-selected role, so pressing Approve granted whatever the person ticked. Members appeared publicly as Advisory Council.
- **Fix:** Defaults to `general`; leadership must be sent explicitly. Admin UI added to correct existing records.
- **Status:** FIXED — **existing records need review** (§4).

### TNR-SEC-008 — Vulnerable dependency: `xlsx`
- **Severity:** MEDIUM
- **Evidence:** `npm audit` — prototype pollution and ReDoS, **no fix available** upstream.
- **Exposure:** Used for admin exports only, on admin-supplied data. Not reachable by an anonymous user.
- **Recommendation:** Migrate to `exceljs`. Not changed here — a blind swap would break every export.
- **Status:** OPEN

### TNR-SEC-009 — Tokens stored in `localStorage`
- **Severity:** MEDIUM
- **Impact:** A single XSS anywhere on the origin exfiltrates admin and member JWTs. `HttpOnly` cookies would not be readable by script.
- **Mitigating:** No `dangerouslySetInnerHTML` anywhere in the codebase; member text is rendered as escaped React children.
- **Status:** OPEN — architectural change, needs its own testing round.

### TNR-SEC-010 — Admin sessions cannot be revoked
- **Severity:** LOW
- **Impact:** Member tokens honour `session_epoch`, so "log out everywhere" works. Admin tokens have no equivalent — a stolen admin token stays valid for its full 12 hours even after a password change.
- **Status:** OPEN

---

## 3. Severity summary

| Severity | Count | Fixed | Open |
|---|---|---|---|
| Critical | 1 | 1 | 0 |
| High | 3 | 3 | 0 |
| Medium | 5 | 3 | 2 |
| Low | 1 | 0 | 1 |

---

## 4. Actions only you can take

These cannot be done from the repository.

**Done during this audit**

- ✅ Repository set to **private** (verified: anonymous fetch of the repo URL now returns nothing).
- ✅ Default credentials removed from the login page and the README.

Both close the *ongoing* exposure. Neither undoes the *past* exposure — see below.

**Immediate — still outstanding**

1. **Check `JWT_SECRET` in Vercel.**
   The new code **refuses to start in production without it**, so set it before deploying.
   - Set, ≥32 random characters → the fallback was never reachable. Near miss, no further action.
   - Unset → TNR-SEC-001 was live while the repo was public. Rotate the secret, which invalidates every existing token, and review `audit_logs` for `ADMIN_LOGIN` entries you do not recognise.
2. **Change the `admin` account password.**
   Making the repo private does not help here: `admin / admin123` was rendered on the **live public `/admin` page**, not only in the repo. Anyone who visited that URL saw it, and they still know it.
3. **Rotate `JWT_SECRET` regardless of what you find in step 1.**
   The literal `tnr_secret` sat in a public repository for the project's lifetime. Anyone who cloned or viewed it in that window still has it. Privacy applied today does not retract what was already copied — and a rotation costs one environment variable change plus everyone signing in again.
4. **Run `supabase/audit_self_granted_roles.sql`** and correct anyone holding Advisory/CEC who granted it to themselves.

**Within 7 days**

5. Rotate the Supabase `service_role` key and the Cloudinary secret if either was ever pasted into a chat, screenshot or issue. RLS denies everything to non-service-role callers, so that key is the single thing standing between an attacker and every table.
6. Confirm Supabase automatic backups — free-plan projects have none. 375 members and 808 votes cannot be recreated.
7. Migrate off `xlsx` (TNR-SEC-008) — no upstream fix exists.

---

## 5. Breach assessment

| Question | Answer |
|---|---|
| Confirmed evidence of breach | **No** |
| Suspicious activity detected | **No** — but see caveat |
| Further investigation required | **Yes** |

**Caveat, stated plainly:** this is a code review. I did not read production logs, Supabase auth logs, or Vercel access logs. A forged-token attack under TNR-SEC-001 would leave *no* failed-login trail and would appear in `audit_logs` as ordinary admin activity. Absence of evidence here is not evidence of absence.

What to check manually: `audit_logs` for `ADMIN_LOGIN` from unfamiliar IPs; `membership_audit_logs` for role changes nobody remembers; Supabase logs for bulk `SELECT` on `membership_members`.

---

## 6. Supabase RLS

RLS is enabled on ~70 tables. Only 6 policies exist, all `SELECT`-only on non-sensitive tables:

| Table | Policy | Risk |
|---|---|---|
| `announcements` | `select using (true)` | None — public content |
| `certificate_settings` | `select using (true)` | None — template text |
| `site_counters` | `select using (true)` | None — visit count |
| `membership_categories` / `_union_councils` / `_villages` | `select using (true)` | None — reference lists |

Every other table — `membership_members`, `membership_applications`, `admin_users`, `votes`, `audit_logs`, `profile_views`, `login_attempts` — has **RLS on and no policy**, which denies all access to the `anon` and `authenticated` roles. Only the `service_role` key reaches them, and it is server-only.

**Assessment: correct, but it is a single layer.** All data protection rests on the service-role key plus the API guards. If that key leaks, RLS provides no second line. This is the strongest argument for making the repo private and rotating the key.

---

## 7. Verification tests

| # | Test | Result |
|---|---|---|
| 1 | Member A cannot edit Member B | **PASS** — 35 member-scoped queries |
| 2 | Member A cannot read B's private data | **PASS** — public routes select an explicit column allowlist |
| 3 | Normal member cannot call admin APIs | **PASS** — 65/65 guarded |
| 4 | Member cannot self-promote | **PASS** after TNR-SEC-007 |
| 5 | Changing a UUID does not bypass authorisation | **PASS**, one exception: `member/guidance/[slug]` — NOT VERIFIED |
| 6 | Anonymous cannot reach protected tables | **PASS** — RLS on, no policies |
| 7 | Service-role key never reaches the browser | **PASS** — no client file imports it |
| 8 | Reset tokens secure and expiring | **PASS** — 32-byte random, 7-day expiry, single use |
| 9 | Sensitive endpoints resist automation | **PASS** after TNR-SEC-004 |
| 10 | Admin actions create audit records | **PARTIAL** — 45/65 routes log |
| 11 | Uploads reject dangerous content | **PARTIAL** — public photo path enforces JPG/PNG/WEBP and 4 MB; the shared `uploadDataUrl` has no allowlist of its own |
| 12 | Production errors leak nothing | **PASS** after TNR-SEC-005 |

---

## 8. Not verified — manual check required

- Whether `JWT_SECRET` is set in production (**the critical unknown**)
- Vercel, Supabase and Cloudflare log contents
- Supabase backup configuration
- Whether Cloudflare proxies the domain
- Git history for previously committed secrets
- `member/guidance/[slug]` object-level authorisation
