-- ════════════════════════════════════════════════════════════════════════════
-- OPPORTUNITIES — public teaser, member-only detail, applications
--
-- Safe to run more than once. ADDITIVE ONLY:
--   • new columns on the existing `opportunities` table (nothing renamed,
--     nothing dropped, nothing re-typed)
--   • three new tables
--   • one new admin permission area
--
-- The existing `opportunities` and `saved_opportunities` rows survive
-- untouched, and every column already in use keeps its meaning. Nothing
-- outside the opportunity module is referenced.
--
-- THE CENTRAL RULE
-- Two groups of columns live on one row. The public teaser columns are safe to
-- serve to anyone; the member-only columns are not. The separation is enforced
-- by which columns each API selects — see the comment on the public view
-- below — and this file names the two groups explicitly so that boundary is
-- documented in the schema rather than only in application code.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── 1. Extend the existing opportunities table ─────────────────────────────
alter table opportunities
  -- Public teaser
  add column if not exists cover_url          text,
  add column if not exists short_description  text,
  add column if not exists category_other     text,     -- when category = 'Other'
  add column if not exists closes_at          timestamptz,

  -- Member-only. Never selected by the public endpoint.
  add column if not exists full_description   text,
  add column if not exists benefits           text,
  add column if not exists duration           text,
  add column if not exists important_dates    text,
  add column if not exists instructions       text,
  add column if not exists terms              text,
  add column if not exists additional_info    text,

  -- How members apply
  add column if not exists application_type   text not null default 'none',
  add column if not exists apply_url          text,

  -- Admin housekeeping
  add column if not exists pinned             boolean not null default false,
  add column if not exists published_at       timestamptz;

/* Application type.
 *   none     — information only
 *   internal — the member applies inside the portal
 *   external — the member is sent to the provider's own site */
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'opportunities_application_type_valid') then
    alter table opportunities add constraint opportunities_application_type_valid
      check (application_type in ('none', 'internal', 'external'));
  end if;
end $$;

/* Status.
 *
 * NOT constrained by a CHECK. The column already holds live values written by
 * the older code, and a constraint added now would reject a row that is
 * already there — turning a migration into an outage. The API validates
 * instead, and `closing soon` is derived from the deadline rather than stored,
 * so it can never disagree with the date.
 *
 * Recognised: draft | published | closed | archived
 * (the older code wrote 'draft' | 'published' | 'archived' — all still valid) */
comment on column opportunities.status is
  'draft | published | closed | archived. "Closing soon" is derived from the '
  'deadline at read time, never stored, so it cannot contradict the date.';

comment on column opportunities.full_description is
  'MEMBER-ONLY. Must never appear in a select served to an unauthenticated '
  'caller — see app/api/public/opportunities/route.js, which lists its columns '
  'explicitly for exactly this reason.';

create index if not exists idx_opp_public on opportunities(status, pinned desc, deadline);

-- ─── 2. Applications ────────────────────────────────────────────────────────
create table if not exists opportunity_applications (
  id             uuid primary key default gen_random_uuid(),

  opportunity_id uuid not null references opportunities(id) on delete cascade,
  -- Linked to the member, NOT a copy of their profile. Name, email, address and
  -- the rest are read live from membership_members when an admin opens the
  -- application, so a member who corrects their phone number does not leave a
  -- stale copy behind in every application they have ever made.
  member_id      uuid not null references membership_members(id) on delete cascade,

  /* Answers specific to this application, as JSON.
   *
   * The five fellowship questions are not columns because the next opportunity
   * will ask five different ones, and a table that grows a column per question
   * per opportunity becomes unmanageable by the third one. The shape is
   * validated in lib/opportunities.js before anything is written. */
  answers        jsonb not null default '{}'::jsonb,

  /* Fields the member had to supply because their profile was missing them.
   * Kept apart from `answers` so it is obvious what came from the profile and
   * what the applicant typed here. */
  profile_gaps   jsonb not null default '{}'::jsonb,

  status         text not null default 'submitted'
                 check (status in ('submitted','shortlisted','interview_invited','selected','rejected','withdrawn')),

  declaration_accepted boolean not null default false,

  -- Set when an interview is arranged. Held on the application so the member
  -- portal can show the details without reading the history table.
  interview      jsonb,

  submitted_at   timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  /* ONE APPLICATION PER MEMBER PER OPPORTUNITY.
   *
   * A database constraint, not a check in the API. Two taps on a slow
   * connection, or a retry after a dropped response, both reach the server as
   * two valid requests — and a "have they applied already?" query followed by
   * an insert has a gap between them where both can pass. This closes it. */
  unique (opportunity_id, member_id)
);

create index if not exists idx_opp_app_member on opportunity_applications(member_id, submitted_at desc);
create index if not exists idx_opp_app_opp    on opportunity_applications(opportunity_id, status);

-- ─── 3. Status history ──────────────────────────────────────────────────────
create table if not exists opportunity_application_history (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references opportunity_applications(id) on delete cascade,
  opportunity_id uuid not null references opportunities(id) on delete cascade,
  member_id      uuid not null references membership_members(id) on delete cascade,

  from_status    text,
  to_status      text not null,
  changed_by     text,                    -- admin username
  note           text,
  interview      jsonb,

  -- pending | sent | failed | not_required
  email_status   text not null default 'not_required',
  email_error    text,
  email_sent_at  timestamptz,

  created_at     timestamptz not null default now()
);

create index if not exists idx_opp_hist_app on opportunity_application_history(application_id, created_at desc);

-- ─── 4. Permission area ─────────────────────────────────────────────────────
/* Opportunities gets its OWN admin area rather than joining "Website Content".
 *
 * Applications carry an applicant's date of birth, contact details,
 * qualification and address. An admin whose job is editing hero slides has no
 * business reading that. A separate area means the committee can appoint an
 * opportunities officer without handing over the rest of the site — and
 * without that officer being handed everyone's personal data by accident.
 *
 * Existing admins who hold 'content' receive it automatically, so nobody has
 * to be re-permissioned for a module that did not exist yesterday. */
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'admin_users_scopes_valid') then
    alter table admin_users drop constraint admin_users_scopes_valid;
  end if;

  alter table admin_users add constraint admin_users_scopes_valid
    check (scopes <@ array['election','membership','content','opinions','inbox','cec','opportunities']::text[]);
end $$;

update admin_users
   set scopes = array_append(scopes, 'opportunities')
 where 'content' = any(scopes)
   and not ('opportunities' = any(scopes));

-- ─── 5. Locked by default ───────────────────────────────────────────────────
-- Every read and write goes through the API, which is the only thing that
-- knows whether the caller is a member, the owner of an application, or an
-- admin. No anon policy is created here, deliberately.
alter table opportunity_applications        enable row level security;
alter table opportunity_application_history enable row level security;

-- ── verify ──────────────────────────────────────────────────────────────────
select status, application_type, count(*) from opportunities group by 1,2 order by 1;
select username, role, scopes from admin_users order by role, username;
