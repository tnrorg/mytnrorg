-- ════════════════════════════════════════════════════════════════════════════
-- Opinions — member-written pieces, published after admin approval
--
-- Safe to run more than once. One new table; nothing existing is touched.
--
-- THE EDIT PROBLEM, AND HOW THIS SOLVES IT
-- A published piece carries the author's name in public. If they could edit it
-- freely afterwards, approval would mean very little — a piece could be
-- approved as one thing and quietly become another.
--
-- So the LIVE text is stored separately from the DRAFT text. Editing a
-- published opinion writes to the draft columns and sets the status back to
-- pending; the published columns keep serving the public page untouched until
-- an admin approves the new version. Nothing goes dark while it waits, and
-- nothing changes in public without a decision.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists opinions (
  id            uuid primary key default gen_random_uuid(),

  -- Author. Cascade: if a member is deleted their writing goes with them,
  -- which is what someone leaving the organisation would expect.
  member_id     uuid not null references membership_members(id) on delete cascade,

  /* ── Draft — what the author is working on ────────────────────────────── */
  title         text not null default '',
  summary       text not null default '',   -- one or two lines for the index
  body          text not null default '',   -- plain text; paragraphs split on blank lines
  cover_url     text,

  /* ── Published — what the public actually reads ───────────────────────────
     Copied from the draft at the moment of approval, never written directly.
     A live page therefore cannot change because someone is mid-edit. */
  published_title   text,
  published_summary text,
  published_body    text,
  published_cover   text,

  -- Set once, at first publication, and never regenerated: a URL that changes
  -- breaks every link anyone has already shared.
  slug          text unique,

  status        text not null default 'draft'
                  check (status in ('draft', 'pending', 'published',
                                    'changes_requested', 'rejected')),

  /* ── Review ──────────────────────────────────────────────────────────── */
  -- Shown to the AUTHOR. Rejecting without saying why leaves someone who wrote
  -- something in good faith with nothing to act on.
  review_note   text not null default '',
  reviewed_by   text,
  reviewed_at   timestamptz,

  submitted_at  timestamptz,
  published_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_opinions_status    on opinions(status);
create index if not exists idx_opinions_member    on opinions(member_id);
create index if not exists idx_opinions_published on opinions(published_at desc);
create unique index if not exists uq_opinions_slug on opinions(slug) where slug is not null;

-- Denies everything to anon and authenticated. Unpublished drafts are private
-- to their author until an admin decides otherwise, so every read goes through
-- the server-side service-role key exactly as with membership records.
alter table opinions enable row level security;

-- ── verify ──────────────────────────────────────────────────────────────────
select status, count(*) from opinions group by status order by status;
