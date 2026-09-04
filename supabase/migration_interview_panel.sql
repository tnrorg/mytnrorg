-- ============================================================================
--  TNR — The interview panel team
--  Run once, AFTER migration_interviews.sql.
--
--  THE PANEL IS MADE OF MEMBERS, NOT ADMIN ACCOUNTS.
--
--  An earlier draft of this seated admin accounts. That was wrong for this
--  organisation: the people who should judge a fellowship candidate are the
--  Executive Committee and the Advisory Council, and most of them have no
--  admin login at all. Seating admins would have meant either handing office
--  bearers admin credentials so they could score — which quietly grants them
--  the applications, the member records and everything else the Opportunities
--  area opens — or leaving the actual panel unable to record anything.
--
--  So: an ADMIN assembles the panel and runs the room. The PANELLISTS are
--  members, and they score from their own member portal. Nobody needs a
--  permission they should not have in order to do their job.
-- ============================================================================

create table if not exists public.interview_panellists (
  id uuid primary key default gen_random_uuid(),

  session_id uuid not null
    references public.interview_sessions(id) on delete cascade,

  -- The member who will score. Normally CEC or Advisory Council.
  member_id uuid not null
    references public.membership_members(id) on delete cascade,

  /* chair | panellist
   *
   * The chair runs the day — calls candidates, closes the session. Their SCORE
   * carries no more weight than anyone else's, and nothing in the code treats
   * it differently; the distinction is about who drives the room. */
  role text not null default 'panellist'
    check (role in ('chair', 'panellist')),

  -- Which admin seated them, for the audit trail.
  added_by uuid references public.admin_users(id) on delete set null,
  created_at timestamptz not null default now(),

  -- One seat per person. Otherwise the same member appears twice and
  -- "2 of 5 scored" is computed against a five containing one person twice.
  unique (session_id, member_id)
);

create index if not exists interview_panellists_session_idx
  on public.interview_panellists (session_id);
-- "Which panels am I on?" — the member portal's first question.
create index if not exists interview_panellists_member_idx
  on public.interview_panellists (member_id);

alter table public.interview_panellists enable row level security;

-- ── Evaluations are given by members too ───────────────────────────────────
/* A new column rather than a changed one.
 *
 * interview_evaluations.panellist_id points at admin_users. Repointing it
 * would break the foreign key on any row already written; adding
 * panellist_member_id leaves those rows readable and makes the new path
 * explicit. The old column stays nullable and unused going forward. */
alter table public.interview_evaluations
  add column if not exists panellist_member_id uuid
    references public.membership_members(id) on delete cascade;

create index if not exists interview_evaluations_member_idx
  on public.interview_evaluations (session_id, panellist_member_id);

/* ONE EVALUATION PER PANELLIST PER CANDIDATE, on the new column.
 *
 * Without this a second save creates a second row and that panellist's opinion
 * is counted twice in every average. The old admin-based constraint is dropped
 * because panellist_id is now null on every new row, and a unique index over
 * (session, application, null) does not constrain anything. */
alter table public.interview_evaluations
  drop constraint if exists interview_evaluations_session_id_application_id_panellist_i_key;

create unique index if not exists interview_evaluations_one_per_panellist
  on public.interview_evaluations (session_id, application_id, panellist_member_id)
  where panellist_member_id is not null;

-- The old column must stop being mandatory, since new rows do not set it.
alter table public.interview_evaluations
  alter column panellist_id drop not null;

-- ============================================================================
--  One new table, one new column, one new unique index. No data is deleted.
--  Safe to run on production, and safe to run twice.
--
--  NOTE: if you already ran the earlier admin-based version of this file, the
--  interview_panellists table will have an admin_id column instead of
--  member_id. It held no real data, so drop it and re-run:
--
--      drop table if exists public.interview_panellists;
--
--  then run this file again.
-- ============================================================================
