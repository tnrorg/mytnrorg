-- ════════════════════════════════════════════════════════════════════════════
-- News & Announcements
--
-- Safe to run more than once. One new table; nothing existing is touched.
--
-- SEPARATE FROM THE TICKER, ON PURPOSE.
-- The `announcements` table stays exactly as it is: one-line notices that
-- scroll at the top of the home page. "Voting closes Friday" belongs there and
-- does not deserve a page of its own. This table is the archive — pieces with
-- a headline, a picture and something to read.
--
-- SEPARATE FROM OPINIONS, ALSO ON PURPOSE.
-- An opinion is one member's view and says so. News is the organisation
-- speaking. Merging them would put TNR's name behind a personal argument, or
-- reduce an official statement to somebody's opinion — and the disclaimer at
-- the foot of an opinion is exactly the difference.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists news_posts (
  id          uuid primary key default gen_random_uuid(),

  title       text not null default '',
  -- One or two lines for cards and link previews. Not the first paragraph of
  -- the body: an opening sentence written to be read in place rarely works as
  -- a summary read on its own.
  summary     text not null default '',
  body        text not null default '',      -- plain text; paragraphs split on blank lines
  cover_url   text,

  category    text not null default 'News'
              check (category in ('News', 'Announcement', 'Event', 'Achievement', 'Press Release')),

  /* Set once, at first publication, and never regenerated.
   *
   * A URL that changes breaks every link already shared — and the WhatsApp
   * message carrying it was the point of publishing. Renaming the headline
   * later must not orphan it. */
  slug        text unique,

  status      text not null default 'draft' check (status in ('draft', 'published')),

  /* Pin to the top of the list, above date order. For the piece that should
     lead the page for a week regardless of what is posted after it. */
  pinned      boolean not null default false,

  /* Optional scheduling.
   *
   * publish_at in the future means written and approved but not yet public —
   * so an announcement timed for a Friday morning does not depend on somebody
   * remembering to press a button on Friday morning. */
  publish_at  timestamptz,
  expires_at  timestamptz,

  views       bigint not null default 0,

  author_name text,                          -- shown as the byline, e.g. "TNR Media Team"
  created_by  text,                          -- admin username, for the audit trail
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_news_live
  on news_posts(status, pinned desc, publish_at desc nulls last, created_at desc);
create index if not exists idx_news_slug     on news_posts(slug);
create index if not exists idx_news_category on news_posts(category);

alter table news_posts enable row level security;

/* Atomic read counter.
 *
 * SECURITY DEFINER with a pinned search_path, matching bump_opinion_views: the
 * function runs with the owner's rights so it can touch a row the caller
 * cannot otherwise write, and pinning the path stops anyone shadowing
 * `news_posts` with their own table to redirect the write.
 *
 * "read the number, add one, write it back" loses counts whenever two people
 * open the same piece in the same moment — which is precisely when a piece is
 * worth counting. */
create or replace function bump_news_views(p_slug text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare v bigint;
begin
  update news_posts
     set views = views + 1
   where slug = p_slug
     and status = 'published'
  returning views into v;
  return coalesce(v, 0);
end;
$$;

comment on table news_posts is
  'Official TNR news and announcements, written by admins. Distinct from '
  '`announcements` (the one-line ticker) and from `opinions` (members writing '
  'in their own name).';

-- ── verify ──────────────────────────────────────────────────────────────────
select status, category, count(*)
  from news_posts
 group by 1, 2
 order by 1, 2;
