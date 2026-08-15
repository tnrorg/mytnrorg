-- ════════════════════════════════════════════════════════════════════════════
-- Replies and edits on comments
--
-- Safe to run more than once. Two columns; no existing row is changed.
-- Run migration_opinion_comments.sql first.
--
-- ONE LEVEL OF REPLY, NOT A TREE.
-- A reply points at a top-level comment. A reply to a reply points at the same
-- top-level comment, so a thread is never more than two deep. This is what
-- Facebook does, and for the same reasons: nesting past two levels is
-- unreadable on a phone, and a moderator scanning a queue cannot tell what a
-- deeply buried remark was answering. The API normalises the parent, so this
-- holds even for a request that tries to nest further.
-- ════════════════════════════════════════════════════════════════════════════

alter table opinion_comments
  -- Cascade: removing a comment removes the replies under it. A reply whose
  -- question has gone is a non-sequitur with somebody's name on it.
  add column if not exists parent_id uuid references opinion_comments(id) on delete cascade,
  -- NULL means never edited. Shown as "edited" beside the timestamp, because a
  -- comment that quietly changes after people have replied to it rewrites the
  -- conversation around it.
  add column if not exists edited_at timestamptz;

create index if not exists idx_opinion_comments_parent
  on opinion_comments(parent_id, created_at) where deleted_at is null;

comment on column opinion_comments.parent_id is
  'Top-level comment this replies to. NULL for a top-level comment. Never '
  'points at another reply — the API flattens deeper nesting to the root.';

-- ── verify ──────────────────────────────────────────────────────────────────
-- Should return no rows: nothing may point at a reply.
select c.id as reply, c.parent_id as points_at
  from opinion_comments c
  join opinion_comments p on p.id = c.parent_id
 where p.parent_id is not null;
