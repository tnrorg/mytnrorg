# TNR — Move the Supabase project to the new account

Goal: get `mytnrorg.vercel.app` showing the real data (375 members, 808 votes)
and end up with the project sitting under the clean/org account.

Tick each box as you go.

---

## Step 0 — Quick safety backup (optional, 5 min, no terminal)

Transfers are low-risk, but this data is irreplaceable. Do a CSV export first.

- [ ] Open the **OLD** project → **Table Editor**
- [ ] For each important table below: click the table → **⋯ (top right) → Export data → Export as CSV**
  - [ ] `members`
  - [ ] `votes`
  - [ ] `vote_receipts`
  - [ ] `candidates`
  - [ ] `tnr_projects`
  - [ ] `tnr_institutions`
  - [ ] `leadership_profiles`
- [ ] Save all CSVs into one folder, e.g. `F:\mytnr\backup-2026-08-08\`

---

## Step 1 — Invite the old account into the new organization

- [ ] Log into the **NEW** Supabase account
- [ ] Top-left → select the **new organization**
- [ ] **Organization Settings** → **Team**
- [ ] **Invite member**
- [ ] Enter the **OLD** account's email address
- [ ] Set role to **Owner**  ← must be Owner, not Administrator
- [ ] Send invite

## Step 2 — Accept the invite

- [ ] Open the **OLD** account's email inbox
- [ ] Find the Supabase invitation → click the link
- [ ] Log in as the OLD account and **Accept**
- [ ] Confirm: the old account can now see both organizations in the top-left switcher

## Step 3 — Make room (free plan = 2 projects max per owner)

- [ ] In the **NEW** organization, open the empty project (66 tables, 0 rows)
- [ ] **Settings → General** → scroll to bottom → **Delete project**
- [ ] Type the project name to confirm

> Only delete the EMPTY one. Double-check it shows 0 members before deleting.

## Step 4 — Transfer the project

- [ ] Log in as the **OLD** account
- [ ] Open the **real** project (the one with 375 members)
- [ ] **Settings → General**
- [ ] Scroll to **Transfer project**
- [ ] Select the **new organization** from the dropdown
- [ ] Confirm

Expect 1–2 minutes of downtime. Wait until the dashboard shows the project as active
under the new organization.

## Step 5 — Point Vercel at this project

The project ref and API keys do **not** change during a transfer, but Vercel is
currently pointing at the deleted empty project — so these must be updated.

- [ ] In the transferred project → **Settings → API**
- [ ] Copy: **Project URL**, **anon public** key, **service_role secret** key
- [ ] Vercel → your project → **Settings → Environment Variables**
- [ ] Update all three (make sure **Production** is ticked on each):
  - [ ] `NEXT_PUBLIC_SUPABASE_URL`
  - [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Also confirm `SUPABASE_STORAGE_BUCKET` = `tnr-media`

## Step 6 — Redeploy without cache

- [ ] Vercel → **Deployments**
- [ ] Latest deployment → **⋯** → **Redeploy**
- [ ] **Uncheck "Use existing Build Cache"**  ← required, `NEXT_PUBLIC_*` is baked in at build time
- [ ] Wait for **Ready**

## Step 7 — Verify

- [ ] Open `https://mytnrorg.vercel.app/api/public/overview`
      → `total_voters` should be a real number, not 0
- [ ] Open `https://mytnrorg.vercel.app/api/public/health`
      → row counts should match the old project
- [ ] Open the site homepage — leadership photos and projects should load
- [ ] Log into `/admin` and confirm the member list shows 375 members

---

## If something looks wrong

| Symptom | Cause | Fix |
|---|---|---|
| Still 0 voters | Build cache | Redeploy again with cache unchecked |
| Images 404 | Storage bucket not public | New project → Storage → `tnr-media` → make public |
| Admin login fails | Password hash mismatch | `node scripts/reset-admin.js <newpassword>` |
| 500 errors | Env var typo / trailing space | Re-paste keys, check URL has no `/rest/v1` on the end |

## After it's working

- [ ] Keep the CSV backup folder for a few weeks
- [ ] Remove the old account from the new org's Team list (optional)
