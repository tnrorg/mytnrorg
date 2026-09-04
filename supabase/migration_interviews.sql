-- ============================================================================
--  TNR — Interview panels in the Virtual Hall
--  Run once in the Supabase SQL editor. Requires migration_meetings.sql and
--  migration_opportunities_v2.sql.
--
--  ONE ROOM, A QUEUE, ONE CANDIDATE AT A TIME.
--
--  The panel opens a single Virtual Hall meeting with the waiting room ON.
--  Thirty candidates wait; the panel admits one, interviews, ends, admits the
--  next. Everything the room already does — waiting room, admission, eject,
--  attendance — is reused. What is missing, and what these three tables add,
--  is the ORDER, the SCORES, and the record of who was actually seen.
--
--  THE APPLICATION STATUS IS NOT TOUCHED BY ANYTHING HERE. That was the
--  organisation's choice: score all thirty first, decide afterwards. There is
--  deliberately no trigger and no cascade that moves an application to
--  'selected' or 'rejected' — a decision made in the room at 11am must still
--  be changeable at 4pm once the whole cohort has been seen.
-- ============================================================================

-- ── The interview day ──────────────────────────────────────────────────────
create table if not exists public.interview_sessions (
  id uuid primary key default gen_random_uuid(),

  opportunity_id uuid not null
    references public.opportunities(id) on delete cascade,

  -- The Virtual Hall meeting the panel sits in. Set to null rather than
  -- cascading if the meeting is later deleted: the scores and the record of
  -- who was interviewed must survive the room being tidied away.
  meeting_id uuid references public.meetings(id) on delete set null,

  title text not null,

  /* The criteria, as an ordered array of { key, label }.
   *
   * Stored ON THE SESSION, not in a settings table. Two reasons: a later
   * cohort can be scored differently without rewriting history, and the
   * criteria a candidate was judged against stay attached to the judgement.
   * A shared settings row that someone edits in March would silently rewrite
   * what January's scores meant. */
  criteria jsonb not null default '[]'::jsonb,

  status text not null default 'open'
    check (status in ('open', 'closed')),

  created_by uuid references public.admin_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists interview_sessions_opportunity_idx
  on public.interview_sessions (opportunity_id, created_at desc);

-- ── The queue ──────────────────────────────────────────────────────────────
create table if not exists public.interview_queue (
  id uuid primary key default gen_random_uuid(),

  session_id uuid not null
    references public.interview_sessions(id) on delete cascade,

  application_id uuid not null
    references public.opportunity_applications(id) on delete cascade,

  -- Denormalised so the queue can be read and ordered without joining out to
  -- the application on every poll during a live panel.
  member_id uuid not null
    references public.membership_members(id) on delete cascade,

  -- Order of interview. Sparse (10, 20, 30…) so a candidate can be moved
  -- between two others without renumbering the whole queue mid-session.
  position int not null default 0,

  state text not null default 'waiting'
    check (state in ('waiting', 'in_progress', 'done', 'no_show', 'skipped')),

  started_at timestamptz,
  ended_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  /* One row per candidate per session.
   *
   * Without this, pressing "add candidates" twice puts thirty people in the
   * queue sixty times, and the panel interviews the first fifteen twice while
   * the rest are never called. */
  unique (session_id, application_id)
);

create index if not exists interview_queue_session_idx
  on public.interview_queue (session_id, position);
create index if not exists interview_queue_state_idx
  on public.interview_queue (session_id, state);

-- ── The scores ─────────────────────────────────────────────────────────────
create table if not exists public.interview_evaluations (
  id uuid primary key default gen_random_uuid(),

  session_id uuid not null
    references public.interview_sessions(id) on delete cascade,

  application_id uuid not null
    references public.opportunity_applications(id) on delete cascade,

  -- The panellist. An admin account, because scoring happens in the admin
  -- console, not in the member-facing room.
  panellist_id uuid not null
    references public.admin_users(id) on delete cascade,

  -- { criterion_key: 1..10 }. Sparse — a panellist who did not judge a
  -- criterion leaves it out rather than scoring it zero, and the average is
  -- taken over what was actually scored.
  scores jsonb not null default '{}'::jsonb,

  notes text,

  /* The panellist's own view, kept separate from the numbers.
   *
   * A recommendation is not derived from the average and must not be: a
   * candidate can score well and still be wrong for the cohort, and the person
   * who sat in the room is better placed to say so than an arithmetic mean.
   * This is advisory — nothing acts on it automatically. */
  recommendation text
    check (recommendation is null or recommendation in ('select', 'reject', 'undecided')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  /* ONE EVALUATION PER PANELLIST PER CANDIDATE.
   *
   * The whole point of a panel is independent judgements. Without this
   * constraint a second save from the same person creates a second row and
   * their opinion is counted twice in every average. */
  unique (session_id, application_id, panellist_id)
);

create index if not exists interview_evaluations_app_idx
  on public.interview_evaluations (session_id, application_id);

-- ── updated_at ─────────────────────────────────────────────────────────────
create or replace function public.touch_interviews()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists interview_sessions_touch on public.interview_sessions;
create trigger interview_sessions_touch before update on public.interview_sessions
  for each row execute function public.touch_interviews();

drop trigger if exists interview_queue_touch on public.interview_queue;
create trigger interview_queue_touch before update on public.interview_queue
  for each row execute function public.touch_interviews();

drop trigger if exists interview_evaluations_touch on public.interview_evaluations;
create trigger interview_evaluations_touch before update on public.interview_evaluations
  for each row execute function public.touch_interviews();

-- ── RLS ────────────────────────────────────────────────────────────────────
/* Enabled with no permissive policy, as everywhere else here.
 *
 * These tables hold what a panel said about a named candidate in private.
 * The service-role key bypasses RLS, so the real boundary is that NO member
 * route reads any of these tables — a candidate has no endpoint through which
 * to reach their own scores, let alone anyone else's. RLS is on so that a
 * future anon-key client gets nothing rather than the panel's notes. */
alter table public.interview_sessions enable row level security;
alter table public.interview_queue enable row level security;
alter table public.interview_evaluations enable row level security;

-- ============================================================================
--  Three new tables. Nothing existing is altered or dropped.
--  Safe to run on production, and safe to run twice.
-- ============================================================================
