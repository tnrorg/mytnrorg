-- ═══════════════════════════════════════════════════════════════════════════
-- TNR MEETINGS — Phase 1 schema
--
-- Nine tables for scheduling, participation, attendance, records and minutes.
-- Safe to run more than once: every statement is guarded.
--
-- ── A NOTE ON ROW LEVEL SECURITY, BECAUSE IT MATTERS HERE ──────────────────
--
-- RLS is enabled on every table below and the policies deny everything by
-- default. That is DEFENCE IN DEPTH, not the security boundary.
--
-- This application does not use Supabase Auth. Members and admins hold
-- bcrypt+JWT sessions minted by the app (lib/membership/auth.js,
-- lib/guard.js), and every database call goes through supabaseAdmin(), which
-- uses the service-role key and therefore BYPASSES RLS ENTIRELY. There is no
-- auth.uid() to write a policy against.
--
-- So the real control on every one of these tables is the server-side check in
-- the API route: requireMember / requireAdmin, then an explicit test that the
-- caller is invited to, hosting, or an admin over, this specific meeting.
-- Enabling RLS with no permissive policy means that if a key ever leaks to a
-- browser, or someone later adds an anon-key client, these tables are closed
-- rather than open. It does not mean the route can skip its own check.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. meetings ────────────────────────────────────────────────────────────
create table if not exists meetings (
  id                    uuid primary key default gen_random_uuid(),

  title                 text not null,
  description           text,
  agenda                text,

  meeting_type          text not null default 'general'
                        check (meeting_type in ('general','executive','advisory',
                          'department','interview','training','workshop','special')),

  -- Absolute instant. The form collects a local date and time and converts on
  -- the client; storing a naive string here is what made news posts invisible
  -- for five hours once already.
  scheduled_at          timestamptz not null,
  duration_minutes      int not null default 60 check (duration_minutes between 5 and 720),

  host_id               uuid not null references membership_members(id) on delete restrict,
  co_host_ids           uuid[] not null default '{}',

  status                text not null default 'scheduled'
                        check (status in ('scheduled','live','completed','cancelled')),

  -- Actual lifecycle instants, distinct from the schedule. A meeting that ran
  -- 20 minutes late has a scheduled_at and a started_at, and attendance
  -- percentage must be measured against what actually happened.
  started_at            timestamptz,
  ended_at              timestamptz,

  waiting_room_enabled  boolean not null default true,
  recording_enabled     boolean not null default false,
  chat_enabled          boolean not null default true,
  screen_share_enabled  boolean not null default true,
  join_before_host      boolean not null default false,
  locked                boolean not null default false,

  -- Optional passcode. Hashed, never stored in the clear: a meeting password
  -- is frequently the same string a member uses elsewhere.
  password_hash         text,

  provider              text not null default 'livekit'
                        check (provider in ('livekit','jitsi','none')),
  -- Opaque room name given to the provider. Never the meeting id: the id
  -- appears in URLs and logs, and a room name that can be guessed from a URL
  -- is a room strangers can try to join.
  room_id               text unique,

  cancelled_reason      text,
  created_by            text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists ix_meetings_when    on meetings(scheduled_at desc);
create index if not exists ix_meetings_status  on meetings(status, scheduled_at desc);
create index if not exists ix_meetings_host    on meetings(host_id);
create index if not exists ix_meetings_type    on meetings(meeting_type);


-- ── 2. meeting_participants ────────────────────────────────────────────────
-- Who was invited, in what capacity, and how they responded.
create table if not exists meeting_participants (
  id             uuid primary key default gen_random_uuid(),
  meeting_id     uuid not null references meetings(id) on delete cascade,
  member_id      uuid not null references membership_members(id) on delete cascade,

  role           text not null default 'participant'
                 check (role in ('host','co_host','participant')),

  invite_status  text not null default 'invited'
                 check (invite_status in ('invited','accepted','declined','joined','missed')),

  -- Which group brought them in ("advisory", "uc:Thowar", "all", "manual").
  -- Kept so an admin can see WHY someone was invited, and so re-running a
  -- group invite does not duplicate people who were added by hand.
  invited_via    text,

  invited_at     timestamptz not null default now(),
  joined_at      timestamptz,
  left_at        timestamptz,
  created_at     timestamptz not null default now(),

  -- ONE INVITATION PER MEMBER PER MEETING, enforced by the database rather
  -- than by a check in the API. "Invite all members" and "invite the Advisory
  -- Council" overlap by design, and the overlap must collapse to one row, not
  -- produce two notifications and two attendance records for one person.
  unique (meeting_id, member_id)
);

create index if not exists ix_mp_meeting on meeting_participants(meeting_id);
create index if not exists ix_mp_member  on meeting_participants(member_id, invite_status);


-- ── 3. meeting_attendance_sessions ─────────────────────────────────────────
/* One row per CONNECTION, not per person.
 *
 * A member on mobile data will drop and rejoin several times in an hour. If
 * attendance were measured from first join to last leave, someone who joined
 * at 8:00, lost signal until 9:00 and returned for the last minute would be
 * recorded as fully present. Summing the sessions instead records the fifteen
 * minutes they were actually there.
 */
create table if not exists meeting_attendance_sessions (
  id               uuid primary key default gen_random_uuid(),
  meeting_id       uuid not null references meetings(id) on delete cascade,
  member_id        uuid not null references membership_members(id) on delete cascade,

  joined_at        timestamptz not null default now(),
  left_at          timestamptz,
  -- Generated, so it can never disagree with the two timestamps it is derived
  -- from. Null while the participant is still connected.
  duration_seconds int generated always as (
    case when left_at is null then null
         else greatest(0, extract(epoch from (left_at - joined_at))::int) end
  ) stored,

  -- Helps diagnose a member who "could not attend": a run of 20-second
  -- sessions is a network problem, not absence.
  disconnect_reason text,
  created_at       timestamptz not null default now()
);

create index if not exists ix_mas_meeting on meeting_attendance_sessions(meeting_id);
create index if not exists ix_mas_member  on meeting_attendance_sessions(meeting_id, member_id);
-- Finding the still-open session to close when someone leaves.
create index if not exists ix_mas_open    on meeting_attendance_sessions(meeting_id, member_id)
  where left_at is null;


-- ── 4. meeting_attendance ──────────────────────────────────────────────────
-- The rolled-up figure per member. Derived from the sessions above; kept as a
-- table rather than a view because the report is read far more often than
-- attendance changes, and because the percentage depends on the meeting's
-- actual duration, which is only known once it ends.
create table if not exists meeting_attendance (
  id                     uuid primary key default gen_random_uuid(),
  meeting_id             uuid not null references meetings(id) on delete cascade,
  member_id              uuid not null references membership_members(id) on delete cascade,

  first_joined_at        timestamptz,
  last_left_at           timestamptz,
  total_duration_seconds int  not null default 0,
  session_count          int  not null default 0,
  attendance_percentage  numeric(5,2) not null default 0,

  attendance_status      text not null default 'absent'
                         check (attendance_status in ('present','late','partial','absent')),

  updated_at             timestamptz not null default now(),
  unique (meeting_id, member_id)
);

create index if not exists ix_ma_meeting on meeting_attendance(meeting_id);
create index if not exists ix_ma_member  on meeting_attendance(member_id);


-- ── 5. meeting_chat ────────────────────────────────────────────────────────
create table if not exists meeting_chat (
  id           uuid primary key default gen_random_uuid(),
  meeting_id   uuid not null references meetings(id) on delete cascade,
  sender_id    uuid references membership_members(id) on delete set null,

  message      text not null,
  message_type text not null default 'text'
               check (message_type in ('text','system','file')),

  -- Host moderation. The row is kept rather than deleted so the chat history
  -- on the record page is an honest transcript.
  deleted_at   timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists ix_mc_meeting on meeting_chat(meeting_id, created_at);


-- ── 6. meeting_recordings ──────────────────────────────────────────────────
create table if not exists meeting_recordings (
  id               uuid primary key default gen_random_uuid(),
  meeting_id       uuid not null references meetings(id) on delete cascade,
  provider         text not null default 'livekit',
  file_url         text,
  file_name        text,
  duration_seconds int,
  file_size        bigint,
  status           text not null default 'processing'
                   check (status in ('processing','ready','failed')),
  created_by       text,
  created_at       timestamptz not null default now()
);

create index if not exists ix_mr_meeting on meeting_recordings(meeting_id);


-- ── 7. meeting_documents ───────────────────────────────────────────────────
create table if not exists meeting_documents (
  id           uuid primary key default gen_random_uuid(),
  meeting_id   uuid not null references meetings(id) on delete cascade,
  title        text not null,
  file_url     text not null,
  file_type    text,
  file_size    bigint,
  -- Agenda packs are often circulated before the meeting; minutes after.
  category     text not null default 'attachment'
               check (category in ('agenda','presentation','minutes','report','attachment')),
  uploaded_by  uuid references membership_members(id) on delete set null,
  created_at   timestamptz not null default now()
);

create index if not exists ix_md_meeting on meeting_documents(meeting_id);


-- ── 8. meeting_minutes ─────────────────────────────────────────────────────
-- One record per meeting.
create table if not exists meeting_minutes (
  id             uuid primary key default gen_random_uuid(),
  meeting_id     uuid not null unique references meetings(id) on delete cascade,
  summary        text,
  key_discussion text,
  decisions      text,

  -- Minutes are a record of what a body decided, so it matters whether they
  -- are a draft someone is still editing or the version the committee stands
  -- behind.
  status         text not null default 'draft'
                 check (status in ('draft','published')),
  published_at   timestamptz,

  created_by     uuid references membership_members(id) on delete set null,
  updated_by     uuid references membership_members(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);


-- ── 9. meeting_action_items ────────────────────────────────────────────────
create table if not exists meeting_action_items (
  id           uuid primary key default gen_random_uuid(),
  meeting_id   uuid not null references meetings(id) on delete cascade,
  title        text not null,
  description  text,
  assigned_to  uuid references membership_members(id) on delete set null,
  deadline     date,
  status       text not null default 'pending'
               check (status in ('pending','in_progress','completed')),
  completed_at timestamptz,
  created_by   uuid references membership_members(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists ix_mai_meeting  on meeting_action_items(meeting_id);
-- "What am I on the hook for?" across every meeting.
create index if not exists ix_mai_assignee on meeting_action_items(assigned_to, status);


-- ── The admin permission area ──────────────────────────────────────────────
-- Its own scope rather than folded into an existing one. Meetings carry
-- attendance records and minutes for the Advisory Council and the CEC; an
-- admin whose job is editing hero slides has no business reading them.
do $$
begin
  if exists (select 1 from information_schema.tables
             where table_name = 'admin_users' and table_schema = 'public') then

    -- Widen the scope whitelist to admit 'meetings'.
    if exists (select 1 from pg_constraint where conname = 'admin_users_scopes_valid') then
      alter table admin_users drop constraint admin_users_scopes_valid;
    end if;

    alter table admin_users
      add constraint admin_users_scopes_valid
      check (scopes <@ array['election','membership','content','opinions',
                             'inbox','cec','opportunities','meetings']::text[]);
  end if;
end $$;
-- Deliberately NOT granted to anyone automatically. Unlike the opportunities
-- rollout, where existing content admins already handled that work, nobody has
-- been running meetings until now — so a super admin decides who gets it
-- rather than the migration handing it out.


-- ── Keep updated_at honest ─────────────────────────────────────────────────
create or replace function tnr_touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['meetings','meeting_attendance','meeting_minutes','meeting_action_items']
  loop
    execute format('drop trigger if exists trg_touch_%1$s on %1$I', t);
    execute format(
      'create trigger trg_touch_%1$s before update on %1$I
       for each row execute function tnr_touch_updated_at()', t);
  end loop;
end $$;


-- ── Row Level Security ─────────────────────────────────────────────────────
-- Enabled with NO permissive policy: closed to every client that is not the
-- service role. See the long note at the top of this file — the server-side
-- guard in each API route is the actual control.
do $$
declare t text;
begin
  foreach t in array array['meetings','meeting_participants','meeting_attendance_sessions',
                           'meeting_attendance','meeting_chat','meeting_recordings',
                           'meeting_documents','meeting_minutes','meeting_action_items']
  loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;


-- ── Check what landed ──────────────────────────────────────────────────────
select table_name,
       (select count(*) from information_schema.columns c
         where c.table_name = t.table_name and c.table_schema = 'public') as columns
from information_schema.tables t
where table_schema = 'public' and table_name like 'meeting%'
order by table_name;
