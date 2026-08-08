-- Scrolling announcement ticker shown between the hero and the statistics bar.
-- Safe to run more than once.

create table if not exists announcements (
  id         uuid primary key default gen_random_uuid(),
  text       text not null,
  href       text,                                  -- optional link
  active     boolean not null default true,
  sort_order int not null default 0,
  -- Optional scheduling. Null on either side means "no bound", so a permanent
  -- welcome line needs no dates while an event notice can expire on its own
  -- rather than relying on someone remembering to remove it.
  starts_at  timestamptz,
  ends_at    timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_announcements_live on announcements(active, sort_order);

alter table announcements enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'announcements'
       and policyname = 'announcements_read'
  ) then
    create policy announcements_read on announcements for select using (true);
  end if;
end $$;

-- A starting line so the ticker is not empty on first load.
insert into announcements (text, sort_order)
select 'Welcome to the TNR Digital Community Platform', 1
where not exists (select 1 from announcements);
