# 🗳️ TNR Election Portal — Tehreek-e-Nojawanan Roundu

A premium, secure, mobile-first **internal organization election portal**.
Members vote with their **registered mobile number + OTP** (WhatsApp primary, SMS backup) — no passwords.
Built with **Next.js 14 + Supabase (PostgreSQL) + Twilio**.

Theme: **Dark Green · Gold · White · Black** · Bilingual **English + اردو**.

---

## ✨ Features

**Member voting flow**
Landing → `CAST YOUR VOTE` → registered mobile → 6-digit OTP (5-min expiry, one-time) → candidate cards → confirm popup → **receipt code `TNR-2026-XXXX`**.

**Fairness**
Candidate results are hidden from the public during voting by default; only live participation shows. Full results appear after the election ends or when the admin publishes. Admins get an optional live preview.

**Admin panel** — dashboard, member management (add / import CSV·Excel / approve / block / search), candidate management (photos, positions, symbols, manifesto), election management (positions, start/pause/end, publish), **voter-list lock** with snapshot + timestamp + admin name, voting records (who voted — never *for whom*), results with charts + PDF/Excel export, and full **audit logs**.

**Security** — one member = one vote (DB unique constraint `election_id + member_id`), OTP hashed + one-time + 5-min expiry, candidates revealed only after OTP verification, voting only within the election window, votes immutable, admins cannot add/edit/delete votes, vote privacy preserved, RLS on all tables (access only via server routes using the service-role key).

---

## 🚀 Setup

### 1. Create a Supabase project
Copy the **Project URL**, **anon key**, and **service_role key** (Project Settings → API).

### 2. Run the database SQL
In Supabase → **SQL Editor**, run in order:
1. `supabase/schema.sql`
2. `supabase/seed.sql`  (creates default admin `admin` / `admin123` — change it after login)

### 3. Create a Storage bucket
Create a **public** bucket named `tnr-media` (see `supabase/storage.md`).

### 4. Configure environment
```bash
cp .env.example .env.local
```
Fill in Supabase keys, a long random `JWT_SECRET`, and Twilio credentials
(`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_SMS_FROM`, `TWILIO_WHATSAPP_FROM`).

### 5. Install & run
```bash
npm install
npm run dev        # http://localhost:3000
```

- Public site: `/`  → vote at `/vote`, live at `/dashboard`, results at `/results`
- Admin panel: `/admin`  (login `admin` / `admin123`)

> **OTP note:** OTP delivery uses Twilio (WhatsApp first, SMS backup). Until Twilio is
> fully configured, in **non-production** the API returns a `dev_code` so you can test the
> whole flow — this never happens in production.

---

## 🗂️ Structure
```
app/                     Next.js App Router
  page.js                Landing
  vote/                  Voting flow (mobile → OTP → candidates → confirm → receipt)
  results/               Public results (fairness-aware)
  dashboard/             Live participation dashboard
  admin/                 Admin panel (tabbed)
  api/                   Route handlers (voting + admin)
components/              UI + admin tab components
lib/                     supabase, twilio, otp, auth, audit, storage, i18n, election logic
supabase/                schema.sql, seed.sql, storage.md
public/tnr-logo.svg      TNR brand logo (replace with official artwork anytime)
```

## 🔐 Admin actions logged
`MEMBER_ADDED`, `MEMBER_APPROVED`, `MEMBER_BLOCKED`, `VOTER_LIST_LOCKED`, `OTP_SENT`,
`OTP_VERIFIED`, `VOTE_SUBMITTED`, `DUPLICATE_VOTE_ATTEMPT`, `RESULT_PUBLISHED`, `ELECTION_*`.

## 📤 Deploy
Deploy to **Vercel** (recommended). Add all `.env.local` variables in the Vercel dashboard.
Set `NEXT_PUBLIC_SUPABASE_URL`, keys, `JWT_SECRET`, and Twilio vars as project env vars.

---
© Tehreek-e-Nojawanan Roundu (TNR) · اتحاد • شعور • عمل
