-- TNR Election Committee members (shown on the homepage, managed from Admin).
create table if not exists committee_members (
  id          uuid primary key default gen_random_uuid(),
  full_name   text not null,
  role        text,
  photo_url   text,
  phone       text,
  email       text,
  bio         text,
  sort_order  int  not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
alter table committee_members enable row level security;
