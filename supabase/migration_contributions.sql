-- ============================================================================
--  TNR — Contribution & Participation Tracking
--  Run once in the Supabase SQL editor.
--
--  WHAT THIS ADDS, AND WHAT IT DELIBERATELY DOES NOT
--
--  Most of a member's contribution is ALREADY recorded by the platform:
--  meeting attendance, opinions written, comments, volunteer hours, event
--  registrations. Copying those into a second "contributions" table would
--  create two versions of the same fact that drift apart the first time
--  someone corrects an attendance record. So the tracker READS those tables
--  and aggregates on demand — 293 members is nothing for Postgres, and a
--  figure computed from the source is a figure that cannot go stale.
--
--  What the platform CANNOT see is the work that happens in Roundu: a
--  cleanliness drive, a school visit, a relief distribution, an office bearer
--  chairing a session in person. That is what this one table is for.
--
--  There is no points column and no rank column, by decision: the tracker
--  reports counts, not a league table of volunteers.
-- ============================================================================

-- ── The offline / manual activity log ──────────────────────────────────────
create table if not exists public.member_activities (
  id uuid primary key default gen_random_uuid(),

  member_id uuid not null
    references public.membership_members(id) on delete cascade,

  -- Vocabulary lives in lib/contributions.js, not in a lookup table: adding
  -- "flood relief" should be a one-line code change reviewed like any other,
  -- not a row somebody inserts into production at midnight.
  activity_type text not null,

  title text not null,
  description text,

  /* A DATE, not a timestamp.
   *
   * This records "the school visit happened on 12 March", which is a day, not
   * an instant. Storing it as a timestamptz meant an activity logged late in
   * the evening in Roundu fell into the previous day once the server rendered
   * it in UTC — and at the year boundary, into the previous YEAR, silently
   * moving it out of the annual report. */
  activity_date date not null,

  -- Optional. Some activities are measured in hours, most are not; a required
  -- hours field would be filled with invented numbers.
  hours numeric(6,2) check (hours is null or (hours >= 0 and hours <= 24)),

  location text,

  /* Who recorded it, and whether anyone stood behind it.
   *
   * An activity log that anybody can write and nobody checks becomes a list of
   * claims. `verified_by` is the office bearer who confirmed it happened;
   * until then the entry shows as unverified everywhere it appears, including
   * to the member. */
  logged_by uuid references public.admin_users(id) on delete set null,
  verified_by uuid references public.admin_users(id) on delete set null,
  verified_at timestamptz,

  -- A photo, a report, a link to the news post about it.
  evidence_url text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

/* The index the tracker actually uses.
 *
 * Every query is "this member, this calendar year" or "everyone, this calendar
 * year". member_id first serves the drill-down and the member's own page;
 * activity_date second serves the year filter within it. */
create index if not exists member_activities_member_date_idx
  on public.member_activities (member_id, activity_date desc);

-- The organisation-wide year sweep reads by date across all members.
create index if not exists member_activities_date_idx
  on public.member_activities (activity_date desc);

create index if not exists member_activities_type_idx
  on public.member_activities (activity_type);

-- ── updated_at ─────────────────────────────────────────────────────────────
create or replace function public.touch_member_activities()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists member_activities_touch on public.member_activities;
create trigger member_activities_touch
  before update on public.member_activities
  for each row execute function public.touch_member_activities();

-- ── RLS ────────────────────────────────────────────────────────────────────
/* Enabled with NO permissive policy, exactly as every other table in this
 * project.
 *
 * This application talks to Postgres with the service-role key, which bypasses
 * RLS entirely — so RLS is not what protects this data, and pretending
 * otherwise would be worse than not having it. The real boundary is
 * requireAdmin / requireMember in the API routes, and in particular the member
 * route that derives the member id from the session token and refuses to
 * accept one as a parameter.
 *
 * RLS is enabled anyway so that a future anon-key client, or somebody poking
 * at the REST endpoint with the public key, gets nothing rather than the
 * activity record of all 293 members. */
alter table public.member_activities enable row level security;

-- ============================================================================
--  Nothing above alters an existing table, drops a column, or touches a row.
--  Safe to run on production, and safe to run twice.
-- ============================================================================
