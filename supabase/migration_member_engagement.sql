-- ============================================================================
--  TNR — Portal usage (member_active_days)
--  Run once in the Supabase SQL editor. Run AFTER migration_contributions.sql.
--
--  WHY THIS TABLE EXISTS, AND WHAT IT IS NOT
--
--  "How many times has this member opened the portal" was not answerable: the
--  platform recorded only `last_login_at`, a single timestamp overwritten on
--  every sign-in, and `login_attempts`, which counts FAILURES for rate
--  limiting. Nothing counted successful use.
--
--  This records ONE ROW PER MEMBER PER DAY they used the portal. Not per page,
--  not per click, not which pages — a day is the smallest unit that answers
--  "are they using it" without becoming a log of somebody's browsing.
--
--  IT IS NOT A MEASURE OF CONTRIBUTION, and the code that reads it says so on
--  screen. In Roundu and the surrounding valleys, how often someone opens a
--  website measures their signal and their data budget. A member who runs a
--  cleanliness drive every month from a village with no coverage will show
--  fewer active days than someone who scrolls the site from Islamabad and does
--  nothing. Used as a performance figure, this table would systematically
--  punish exactly the members doing the most physical work.
--
--  So it is displayed under "Account use", separately from contribution, it is
--  excluded from every contribution total, and — importantly — the member sees
--  the same figure on their own page. Nothing is recorded about a person here
--  that the person cannot see about themselves.
-- ============================================================================

create table if not exists public.member_active_days (
  member_id uuid not null
    references public.membership_members(id) on delete cascade,

  -- A DATE in TNR time, decided by the application, not by the database.
  -- `current_date` on the server would be UTC, so an evening session in Roundu
  -- would be filed under the previous day.
  day date not null,

  -- How many times the day was touched. Rough by design: the row is written
  -- once per day on the first authenticated request, so this stays 1 for
  -- almost everyone. It exists so a later change can count sessions without
  -- another migration.
  hits int not null default 1,

  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),

  primary key (member_id, day)
);

-- "Days active this year, for this member" — the drill-down and the member's
-- own page. Descending because recent days are what gets read.
create index if not exists member_active_days_member_idx
  on public.member_active_days (member_id, day desc);

-- "Everyone active in this period" — the organisation-wide sweep.
create index if not exists member_active_days_day_idx
  on public.member_active_days (day desc);

-- ── Last seen, on the member record ────────────────────────────────────────
/* Kept on membership_members as well as in the table above.
 *
 * requireMember already loads the member row on every authenticated request.
 * Having last_seen_at there means the "have we already counted today?" check
 * costs nothing — no extra read — and the daily upsert happens at most once
 * per member per day instead of on every single API call. */
alter table public.membership_members
  add column if not exists last_seen_at timestamptz;

create index if not exists membership_members_last_seen_idx
  on public.membership_members (last_seen_at desc nulls last);

-- ── RLS ────────────────────────────────────────────────────────────────────
-- Enabled with no permissive policy, as everywhere else in this project: the
-- service-role key bypasses RLS, so the real boundary is the API routes. This
-- stops an anon-key client reading the whole organisation's usage.
alter table public.member_active_days enable row level security;

-- ============================================================================
--  Adds one table and one nullable column. Nothing is altered or dropped.
--  Safe to run on production, and safe to run twice.
-- ============================================================================
