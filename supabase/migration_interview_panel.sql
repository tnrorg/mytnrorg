-- ============================================================================
--  TNR — The interview panel team
--  Run once, AFTER migration_interviews.sql.
--
--  WHY THIS EXISTS
--
--  Until now anybody holding the Opportunities permission could file scores
--  against a candidate. That is too wide. The Opportunities area is granted so
--  someone can publish a scholarship and read applications; it should not also
--  make them a member of every interview panel that ever runs.
--
--  From here the panel is a NAMED LIST, assigned when the session is set up,
--  and the API refuses an evaluation from anyone not on it. That matters for
--  two reasons: a score carries the name of the person who gave it, and the
--  denominator in "3 of 4 panellists have scored" is only meaningful if there
--  is a definite 4.
-- ============================================================================

create table if not exists public.interview_panellists (
  id uuid primary key default gen_random_uuid(),

  session_id uuid not null
    references public.interview_sessions(id) on delete cascade,

  -- The admin account that will do the scoring.
  admin_id uuid not null
    references public.admin_users(id) on delete cascade,

  /* chair | panellist
   *
   * The chair is the person who runs the day — calls candidates, closes the
   * session. Their SCORE carries no more weight than anyone else's, and
   * nothing in the code treats it differently; the distinction is about who
   * drives the room, not whose opinion counts more. */
  role text not null default 'panellist'
    check (role in ('chair', 'panellist')),

  added_by uuid references public.admin_users(id) on delete set null,
  created_at timestamptz not null default now(),

  -- One seat per person. Otherwise the same admin appears twice on the roster
  -- and "2 of 5 scored" is computed against a five that contains one person
  -- listed twice.
  unique (session_id, admin_id)
);

create index if not exists interview_panellists_session_idx
  on public.interview_panellists (session_id);

alter table public.interview_panellists enable row level security;

-- ============================================================================
--  BACKFILL: existing sessions keep working.
--
--  A session created before this migration has no roster, so a strict check
--  would lock its panel out of scores they are midway through giving. Anyone
--  who has ALREADY scored in that session, plus whoever created it, is seated
--  on the panel automatically. Sessions created from now on are explicit.
-- ============================================================================
insert into public.interview_panellists (session_id, admin_id, role)
select distinct e.session_id, e.panellist_id, 'panellist'
from public.interview_evaluations e
on conflict (session_id, admin_id) do nothing;

insert into public.interview_panellists (session_id, admin_id, role)
select s.id, s.created_by, 'chair'
from public.interview_sessions s
where s.created_by is not null
on conflict (session_id, admin_id) do nothing;

-- ============================================================================
--  One new table and a backfill of existing data. Nothing is altered or
--  dropped. Safe to run on production, and safe to run twice.
-- ============================================================================
