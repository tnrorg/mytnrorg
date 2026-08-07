-- Admin-managed Union Councils and their Villages / Areas.
-- The application form reads these as dependent dropdowns so applicants pick
-- from a controlled list instead of free-typing village names — that is what
-- keeps the Members Analytics grouping clean.
-- Safe to run more than once.

create table if not exists membership_union_councils (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  sort_order int  not null default 0,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists membership_villages (
  id               uuid primary key default gen_random_uuid(),
  union_council_id uuid not null references membership_union_councils(id) on delete cascade,
  name             text not null,
  sort_order       int  not null default 0,
  active           boolean not null default true,
  created_at       timestamptz not null default now(),
  unique (union_council_id, name)
);

create index if not exists idx_villages_uc on membership_villages (union_council_id, sort_order);

alter table membership_union_councils enable row level security;
alter table membership_villages       enable row level security;

-- ── Seed from areas already on member records, so nothing is retyped ────────
insert into membership_union_councils (name)
select distinct trim(union_council)
from membership_members
where coalesce(trim(union_council), '') <> ''
on conflict (name) do nothing;

-- Villages whose members have no union council recorded go under "Unassigned"
-- so the admin can move them to the right council later.
insert into membership_union_councils (name)
select 'Unassigned'
where exists (
  select 1 from membership_members
  where coalesce(trim(village), '') <> '' and coalesce(trim(union_council), '') = ''
)
on conflict (name) do nothing;

insert into membership_villages (union_council_id, name)
select uc.id, v.village
from (
  select distinct
    trim(village) as village,
    coalesce(nullif(trim(union_council), ''), 'Unassigned') as council
  from membership_members
  where coalesce(trim(village), '') <> ''
) v
join membership_union_councils uc on uc.name = v.council
on conflict (union_council_id, name) do nothing;
