-- Home page hero carousel — every slide is written by an admin.
--
-- Text, image, buttons, overlay strength and the font sizes for phone and
-- desktop are all columns here, so nothing about the hero lives in the code.
-- The table starts EMPTY: with no slides the home page keeps showing the
-- existing static hero, so running this migration cannot break the front page.
--
-- Safe to run more than once. Touches nothing in the election system.

create table if not exists hero_slides (
  id                  uuid primary key default gen_random_uuid(),

  -- Content
  eyebrow             text not null default '',
  title               text not null default '',
  subtitle            text not null default '',
  image_url           text,
  cta1_label          text not null default '',
  cta1_href           text not null default '',
  cta2_label          text not null default '',
  cta2_href           text not null default '',

  -- Layout
  align               text not null default 'left' check (align in ('left', 'center')),
  -- How dark the image is behind the text. Too low and white text becomes
  -- unreadable over a bright photo, so the admin screen warns below 35.
  overlay             int  not null default 55 check (overlay between 0 and 95),

  -- Type scale, kept separate for phone and desktop: one size that suits a
  -- 15-inch screen is unreadable on a phone, and vice versa.
  title_size_mobile   int not null default 32 check (title_size_mobile between 16 and 80),
  title_size_desktop  int not null default 56 check (title_size_desktop between 20 and 140),
  text_size_mobile    int not null default 15 check (text_size_mobile between 11 and 32),
  text_size_desktop   int not null default 17 check (text_size_desktop between 11 and 40),

  active              boolean not null default true,
  sort_order          int not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists hero_slides_order_idx on hero_slides (active, sort_order, created_at);

-- RLS on with no public policy: reads go through the service-role API route,
-- matching every other table in this project.
alter table hero_slides enable row level security;
