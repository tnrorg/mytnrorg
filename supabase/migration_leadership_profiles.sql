-- Leadership profiles: Advisory Council + Central Executive Committee.
-- One table, distinguished by `body`, so a single admin screen manages both.
-- Safe to run more than once.

create table if not exists leadership_profiles (
  id            uuid primary key default gen_random_uuid(),
  body          text not null check (body in ('advisory', 'executive')),
  slug          text not null,
  name          text,                      -- may be blank -> card shows "To Be Announced"
  designation   text,                      -- CEC: President, Vice President …
  qualification text,                      -- PhD, Masters, Commerce Graduate …
  field         text,                      -- (Climate & Energy Policy)
  affiliation   text,                      -- university / employer / organisation
  summary       text,                      -- one-line role description
  expertise     text[]  not null default '{}',
  duties        text[]  not null default '{}',
  photo_url     text,
  sort_order    int     not null default 0,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create unique index if not exists uq_leadership_body_slug on leadership_profiles (body, slug);
create index if not exists ix_leadership_body_sort on leadership_profiles (body, sort_order);

-- No public policies: every read and write goes through server routes using the
-- service role, exactly like the rest of the platform.
alter table leadership_profiles enable row level security;
