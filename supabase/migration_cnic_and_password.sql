-- Identity verification (CNIC front/back) + password chosen at application time.
-- Safe to run more than once.

-- ── 1. Application columns ────────────────────────────────────────────────
-- Only the storage PATH is kept, never a public URL. Reading a document always
-- goes through an admin-only endpoint that mints a short-lived signed link.
alter table membership_applications add column if not exists cnic_number      text;
alter table membership_applications add column if not exists cnic_front_path  text;
alter table membership_applications add column if not exists cnic_back_path   text;

-- Password the applicant chose on the form. Already bcrypt-hashed by the API —
-- the plain value is never stored or logged.
alter table membership_applications add column if not exists password_hash    text;

-- ── 2. Carry the same fields onto the approved member ─────────────────────
alter table membership_members add column if not exists cnic_number     text;
alter table membership_members add column if not exists cnic_front_path text;
alter table membership_members add column if not exists cnic_back_path  text;

-- ── 3. Private storage bucket ─────────────────────────────────────────────
-- NOT public. Cloudinary and the tnr-media bucket are both world-readable by
-- URL, which is fine for a portrait and unacceptable for an identity document.
insert into storage.buckets (id, name, public)
values ('tnr-private', 'tnr-private', false)
on conflict (id) do update set public = false;

-- No RLS policies are added on purpose. With none, only the service-role key
-- can read or write — which is exactly the intent: every access goes through
-- the server, and the anon key can never reach these files.

-- ── 4. Verify ─────────────────────────────────────────────────────────────
select id, public from storage.buckets where id = 'tnr-private';
