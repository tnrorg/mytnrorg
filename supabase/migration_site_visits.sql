-- Website visitor counter for the home-page statistics bar.
-- Safe to run more than once.

-- A single-row counter rather than one row per visit. A visits table would
-- grow without bound and the home page only ever needs the total, so storing
-- the individual rows would cost storage and query time for nothing.
create table if not exists site_counters (
  key        text primary key,
  value      bigint not null default 0,
  updated_at timestamptz not null default now()
);

insert into site_counters (key, value) values ('visits', 0)
  on conflict (key) do nothing;

-- Atomic increment. Doing this as read-then-write in application code loses
-- counts under concurrency; a single UPDATE inside the database does not.
create or replace function increment_site_visits(amount int default 1)
returns bigint
language sql
security definer
set search_path = public
as $$
  insert into site_counters (key, value, updated_at)
  values ('visits', amount, now())
  on conflict (key) do update
    set value = site_counters.value + amount,
        updated_at = now()
  returning value;
$$;

alter table site_counters enable row level security;

-- Readable by anyone; writes only ever happen through the function above,
-- called with the service-role key from the API route.
do $$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'site_counters'
       and policyname = 'site_counters_read'
  ) then
    create policy site_counters_read on site_counters for select using (true);
  end if;
end $$;

-- Optional: seed the counter with a figure from your previous analytics so the
-- number does not restart at zero. Edit and run once if you want that.
--   update site_counters set value = 12345 where key = 'visits';
