-- ════════════════════════════════════════════════════════════════════════════
-- Likes on Opinions
--
-- Safe to run more than once. One new table; nothing existing is touched.
--
-- WHO SEES WHAT
--   Public reader  — the Like button, and whether THEY have liked it. No totals.
--   Author         — the view count, the like count, and the names of members
--                    who liked. Only for their own pieces.
--   Nobody         — the names of people who merely READ a piece. Reading is
--                    not a public act; a member who quietly opens an article is
--                    not reported to its author.
--
-- A signed-in member is recorded by id. A signed-out visitor is recorded by a
-- random key their browser keeps, hashed before storage so the raw value never
-- sits in the table. Anonymous likes therefore count, but cannot be named —
-- which is exactly what the author's list shows, and why it says "and N others".
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists opinion_likes (
  id          uuid primary key default gen_random_uuid(),

  opinion_id  uuid not null references opinions(id) on delete cascade,

  -- Set for a signed-in member. Cascade so a departing member's likes leave
  -- with them, the same rule their own writing follows.
  member_id   uuid references membership_members(id) on delete cascade,

  -- Set for a signed-out visitor: sha256 of their browser key. Never the raw
  -- key, so the table cannot be used to recognise a specific browser.
  anon_key    text,

  -- Hashed client address, kept only to slow down bulk liking. Not shown to
  -- anyone, including the author.
  ip_hash     text,

  created_at  timestamptz not null default now(),

  -- Exactly one identity per row. A row with neither could never be
  -- de-duplicated; a row with both would be counted twice.
  constraint opinion_likes_one_identity check (
    (member_id is not null and anon_key is null) or
    (member_id is null and anon_key is not null)
  )
);

-- One like each. Partial indexes because the unused column is null, and null
-- is not equal to null in a plain unique constraint — without `where`, a
-- member could like the same piece any number of times.
create unique index if not exists uq_opinion_likes_member
  on opinion_likes(opinion_id, member_id) where member_id is not null;
create unique index if not exists uq_opinion_likes_anon
  on opinion_likes(opinion_id, anon_key) where anon_key is not null;

create index if not exists idx_opinion_likes_opinion on opinion_likes(opinion_id);
create index if not exists idx_opinion_likes_ip      on opinion_likes(ip_hash, created_at);

-- Locked by default. Every read and write goes through the API, which is the
-- only thing that knows whether the caller is the author.
alter table opinion_likes enable row level security;

comment on table opinion_likes is
  'Likes on published opinions. Totals and liker names are visible ONLY to the '
  'author of the piece — never on the public page.';

-- ── verify ──────────────────────────────────────────────────────────────────
select o.slug,
       o.views,
       count(l.id)                                        as likes,
       count(l.id) filter (where l.member_id is not null)  as named_likes
  from opinions o
  left join opinion_likes l on l.opinion_id = o.id
 where o.status = 'published'
 group by o.id, o.slug, o.views
 order by likes desc;
