-- ════════════════════════════════════════════════════════════════════════════
-- Comments on Opinions
--
-- Safe to run more than once. One new table; nothing existing is touched.
--
-- MEMBERS ONLY, VISIBLE IMMEDIATELY, REMOVABLE BY THREE PEOPLE.
--   Anyone           — can read.
--   Signed-in member — can post, and can delete their own comment.
--   The author       — can delete any comment on their own piece.
--   Any admin        — can delete anything.
--
-- Every comment carries a real name and membership number. That is the
-- moderation policy as much as the delete button is: people write differently
-- under their own name in front of their own community.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists opinion_comments (
  id          uuid primary key default gen_random_uuid(),

  opinion_id  uuid not null references opinions(id) on delete cascade,

  -- Cascade: a member who leaves takes their comments with them, the same rule
  -- their own writing and their likes already follow.
  member_id   uuid not null references membership_members(id) on delete cascade,

  body        text not null check (length(btrim(body)) between 2 and 2000),

  /* Soft delete.
   *
   * A removed comment is hidden, not erased. If a member later asks why their
   * comment disappeared, or a committee decision is questioned, the row and
   * the name of whoever removed it are still there. A hard delete answers
   * neither question, and the disagreement usually arrives after the fact. */
  deleted_at  timestamptz,
  deleted_by  text,                    -- admin username, 'author', or 'self'

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- The article page reads live comments oldest-first; the admin queue reads
-- everything newest-first across all articles.
create index if not exists idx_opinion_comments_thread
  on opinion_comments(opinion_id, created_at) where deleted_at is null;
create index if not exists idx_opinion_comments_recent
  on opinion_comments(created_at desc);
-- Backs the per-member flood check in the API.
create index if not exists idx_opinion_comments_member
  on opinion_comments(member_id, created_at desc);

-- Locked by default. Every read and write goes through the API, which is the
-- only thing that knows who is asking and what they are allowed to remove.
alter table opinion_comments enable row level security;

comment on table opinion_comments is
  'Member comments on published opinions. Visible immediately; removable by the '
  'comment author, the author of the piece, or any admin. Removal is a soft '
  'delete so the record of what was said and who removed it survives.';

-- ── verify ──────────────────────────────────────────────────────────────────
select o.slug,
       count(*) filter (where c.deleted_at is null) as live,
       count(*) filter (where c.deleted_at is not null) as removed
  from opinions o
  left join opinion_comments c on c.opinion_id = o.id
 where o.status = 'published'
 group by o.id, o.slug
 order by live desc;
