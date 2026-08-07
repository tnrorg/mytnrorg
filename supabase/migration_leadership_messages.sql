-- Founder's Message and President's Message shown on the home page.
--
-- Two fixed rows keyed by role, so the admin screen always edits the same
-- records and the home page can order them without a sort UI. Content is
-- deliberately seeded EMPTY: no names, photos or words are invented here, and
-- the section stays hidden until an admin writes and publishes it.
--
-- Safe to run more than once. Touches nothing in the election system.

create table if not exists leadership_messages (
  key            text primary key check (key in ('founder', 'president')),
  heading        text not null default '',   -- section title, e.g. "Founder's Message"
  name           text not null default '',   -- filled by the admin
  designation    text not null default '',
  photo_url      text,
  signature_url  text,
  message        text not null default '',
  published      boolean not null default false,
  sort_order     int not null default 0,
  updated_at     timestamptz not null default now()
);

insert into leadership_messages (key, heading, designation, sort_order) values
  ('founder',   'From Our Founder',   'Founder',           1),
  ('president', 'From Our President', 'Central President', 2)
on conflict (key) do nothing;

-- Bring the earlier seed wording into line, but only where an admin has not
-- already chosen their own heading.
update leadership_messages set heading = 'From Our Founder'
  where key = 'founder'   and heading in ('', 'Founder''s Message');
update leadership_messages set heading = 'From Our President'
  where key = 'president' and heading in ('', 'President''s Message');

-- RLS on with no public policy: reads go through the service-role API route,
-- matching every other table in this project.
alter table leadership_messages enable row level security;
