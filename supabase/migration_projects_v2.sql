-- Development projects tracker — public accountability view.
--
-- These are GOVERNMENT development schemes in the constituency, not TNR's own
-- work: approval stage, funding, start dates, cost and physical progress, so
-- residents can see what has been sanctioned for their village.
--
-- Two things this schema deliberately insists on:
--   1. `source` — where each figure came from (department notification, PC-1,
--      press release). Publishing public-spending figures without being able
--      to say where they came from is how a transparency page turns into a
--      liability.
--   2. `last_verified` — when someone last checked. A stale figure presented
--      as current is worse than no figure.
--
-- Additive and safe to run more than once, including on top of
-- migration_projects.sql if that has already been applied.

-- Base table, in case migration_projects.sql was never run.
create table if not exists tnr_projects (
  id             uuid primary key default gen_random_uuid(),
  title          text not null default '',
  category       text not null default '',
  status         text not null default 'ongoing',
  union_council  text not null default '',
  village        text not null default '',
  year           int,
  beneficiaries  int not null default 0,
  volunteers     int not null default 0,
  summary        text not null default '',
  image_url      text,
  published      boolean not null default true,
  sort_order     int not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ── Government scheme fields ────────────────────────────────────────────────
alter table tnr_projects add column if not exists scheme_no      text not null default '';
alter table tnr_projects add column if not exists department     text not null default '';
alter table tnr_projects add column if not exists contractor     text not null default '';

-- Money, in whole rupees. numeric(16,2) rather than a float: rounding errors
-- have no place in published public-spending figures.
alter table tnr_projects add column if not exists approved_cost  numeric(16,2) not null default 0;
alter table tnr_projects add column if not exists released_funds numeric(16,2) not null default 0;
alter table tnr_projects add column if not exists utilised_funds numeric(16,2) not null default 0;

-- Dates
alter table tnr_projects add column if not exists approved_date   date;
alter table tnr_projects add column if not exists start_date      date;
alter table tnr_projects add column if not exists target_date     date;
alter table tnr_projects add column if not exists completion_date date;

-- Photo gallery. An array of public URLs rather than a child table: the only
-- thing a photo needs here is its position in the strip, and a separate table
-- would add a join for no gain.
alter table tnr_projects add column if not exists gallery text[] not null default '{}';

alter table tnr_projects add column if not exists progress_percent int not null default 0;
alter table tnr_projects add column if not exists source           text not null default '';
alter table tnr_projects add column if not exists last_verified    date;

-- ── Status pipeline ─────────────────────────────────────────────────────────
-- Replaces the earlier, shorter list. Dropped as a separate step so re-running
-- the file does not fail on an already-correct constraint.
alter table tnr_projects drop constraint if exists tnr_projects_status_check;
update tnr_projects set status = 'ongoing'
  where status not in ('proposed', 'pending_approval', 'approved', 'ongoing', 'completed', 'on_hold', 'dropped');
alter table tnr_projects add constraint tnr_projects_status_check
  check (status in ('proposed', 'pending_approval', 'approved', 'ongoing', 'completed', 'on_hold', 'dropped'));

alter table tnr_projects drop constraint if exists tnr_projects_progress_check;
alter table tnr_projects add constraint tnr_projects_progress_check
  check (progress_percent between 0 and 100);

create index if not exists tnr_projects_public_idx on tnr_projects (published, sort_order, created_at);
create index if not exists tnr_projects_area_idx   on tnr_projects (union_council, village);

alter table tnr_projects enable row level security;

-- ── Page settings ───────────────────────────────────────────────────────────
-- Who the page is about and where the data comes from. Kept as editable data
-- rather than written into the code, so no name or claim is hardcoded by a
-- developer — an admin enters it and can correct it at any time.
create table if not exists project_settings (
  id                   int primary key default 1 check (id = 1),
  page_title           text not null default 'Development Projects',
  page_intro           text not null default '',
  representative_name  text not null default '',
  representative_title text not null default '',
  constituency         text not null default '',
  currency             text not null default 'PKR',
  source_note          text not null default '',
  updated_at           timestamptz not null default now()
);

insert into project_settings (id) values (1) on conflict (id) do nothing;
alter table project_settings enable row level security;
