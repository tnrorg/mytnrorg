-- TNR projects — the source for the Projects Statistics page.
--
-- Member records cannot answer "how many projects has TNR delivered", so this
-- table exists rather than the page inventing figures. It starts EMPTY: with
-- no projects the public page says so plainly instead of showing zeros dressed
-- up as achievements.
--
-- Safe to run more than once. Touches nothing in the election system.

create table if not exists tnr_projects (
  id             uuid primary key default gen_random_uuid(),

  title          text not null default '',
  category       text not null default '',      -- Education, Health, Welfare, …
  status         text not null default 'ongoing'
                   check (status in ('planned', 'ongoing', 'completed', 'on_hold')),

  -- Where it happened. Free text so it can hold an area that predates the
  -- managed Areas list, or a project covering the whole district.
  union_council  text not null default '',
  village        text not null default '',

  year           int check (year is null or (year between 1990 and 2100)),
  beneficiaries  int not null default 0 check (beneficiaries >= 0),
  volunteers     int not null default 0 check (volunteers >= 0),

  summary        text not null default '',
  image_url      text,

  published      boolean not null default true,
  sort_order     int not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists tnr_projects_public_idx on tnr_projects (published, sort_order, created_at);

-- RLS on with no public policy: reads go through the service-role API route,
-- matching every other table in this project.
alter table tnr_projects enable row level security;
