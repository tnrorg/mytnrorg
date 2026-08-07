-- ═══════════════════════════════════════════════════════════════════════
-- TNR MEMBERSHIP — PHASE 6: opportunities, events, volunteer, support
-- Election tables untouched.
-- ═══════════════════════════════════════════════════════════════════════
begin;

-- ─── Opportunities (jobs, scholarships, internships…) ──────────────────
create table if not exists opportunities (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  category      text not null default 'Local Jobs',
  organization  text,
  location      text,
  description   text,
  eligibility   text,
  required_documents text,
  external_url  text,
  deadline      date,
  status        text not null default 'draft',   -- draft | published | archived
  created_by    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_opp_status on opportunities(status, deadline);

create table if not exists saved_opportunities (
  id             uuid primary key default gen_random_uuid(),
  member_id      uuid not null references membership_members(id) on delete cascade,
  opportunity_id uuid not null references opportunities(id) on delete cascade,
  applied        boolean not null default false,
  notes          text,
  created_at     timestamptz not null default now(),
  unique (member_id, opportunity_id)
);

-- ─── Events ────────────────────────────────────────────────────────────
create table if not exists events (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  description   text,
  mode          text default 'online',           -- online | physical
  location      text,
  meeting_url   text,
  starts_at     timestamptz,
  ends_at       timestamptz,
  capacity      int,
  registration_deadline timestamptz,
  status        text not null default 'draft',   -- draft | published | archived
  created_by    text,
  created_at    timestamptz not null default now()
);
create index if not exists idx_ev_status on events(status, starts_at);

create table if not exists event_registrations (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references events(id) on delete cascade,
  member_id  uuid not null references membership_members(id) on delete cascade,
  attended   boolean not null default false,
  created_at timestamptz not null default now(),
  unique (event_id, member_id)
);

-- ─── Volunteer ─────────────────────────────────────────────────────────
create table if not exists volunteer_opportunities (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  area        text,
  description text,
  requirements text,
  status      text not null default 'draft',
  created_by  text,
  created_at  timestamptz not null default now()
);

create table if not exists volunteer_assignments (
  id          uuid primary key default gen_random_uuid(),
  volunteer_opportunity_id uuid references volunteer_opportunities(id) on delete cascade,
  member_id   uuid not null references membership_members(id) on delete cascade,
  department  text,
  task        text,
  progress    text default 'assigned',           -- assigned | in_progress | completed
  supervisor_feedback text,
  status      text not null default 'applied',   -- applied | accepted | rejected | completed
  created_at  timestamptz not null default now(),
  unique (volunteer_opportunity_id, member_id)
);

create table if not exists volunteer_hours (
  id            uuid primary key default gen_random_uuid(),
  assignment_id uuid references volunteer_assignments(id) on delete cascade,
  member_id     uuid not null references membership_members(id) on delete cascade,
  hours         numeric(6,2) not null default 0,
  activity_date date,
  note          text,
  created_at    timestamptz not null default now()
);

-- ─── Private documents ─────────────────────────────────────────────────
create table if not exists member_documents (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references membership_members(id) on delete cascade,
  category    text,
  title       text not null,
  file_path   text not null,                    -- private storage path, NEVER public
  file_type   text,
  file_size   int,
  created_at  timestamptz not null default now()
);
create index if not exists idx_mdoc_member on member_documents(member_id);

-- ─── Support tickets ───────────────────────────────────────────────────
create table if not exists support_tickets (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references membership_members(id) on delete cascade,
  ticket_no   text unique,
  category    text not null default 'General Inquiry',
  subject     text not null,
  priority    text not null default 'normal',
  status      text not null default 'open',     -- open | in_progress | resolved | closed
  assigned_to text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_st_member on support_tickets(member_id, status);

create table if not exists support_messages (
  id         uuid primary key default gen_random_uuid(),
  ticket_id  uuid not null references support_tickets(id) on delete cascade,
  sender     text not null,                     -- member | admin
  sender_name text,
  message    text not null,
  internal   boolean not null default false,    -- admin-only note
  created_at timestamptz not null default now()
);
create index if not exists idx_sm_ticket on support_messages(ticket_id);

create sequence if not exists support_ticket_seq start 1;

alter table opportunities            enable row level security;
alter table saved_opportunities      enable row level security;
alter table events                   enable row level security;
alter table event_registrations      enable row level security;
alter table volunteer_opportunities  enable row level security;
alter table volunteer_assignments    enable row level security;
alter table volunteer_hours          enable row level security;
alter table member_documents         enable row level security;
alter table support_tickets          enable row level security;
alter table support_messages         enable row level security;

commit;
