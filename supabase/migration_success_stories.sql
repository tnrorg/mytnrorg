-- ════════════════════════════════════════════════════════════════════════════
--  TNR Success Stories — member achievements, published after admin review
--  Run once in the Supabase SQL editor.
--
--  WHAT THIS IS FOR
--  A member finishes a degree, lands a job, earns a certificate, wins
--  something. They submit it from their portal; an office bearer reviews it;
--  once approved it appears on the public site as a card with their photo.
--
--  WHY THERE IS NO DRAFT/PUBLISHED COLUMN PAIR HERE
--
--  The Opinions table keeps two copies of every field — a draft the author is
--  editing and a published copy the public reads — so that editing a live
--  article cannot change what the public sees before an admin approves the new
--  version. That is right for an article, which is a document people revise.
--
--  An achievement is not a document. "MSc Computer Science, University of
--  Baltistan, 2026" is a fact about a moment; it does not get rewritten, it
--  gets joined by the next one. So a story is editable while it is waiting or
--  has been sent back, and fixed once published. A member who wants to record
--  something else submits another story. One table, half the columns, and no
--  way for a published card to silently become a different card.
--
--  WHY NAME AND PHOTO ARE NOT STORED HERE
--
--  They are read from the member's record when the page is built. A member who
--  updates their photograph should see it update on every card they have — the
--  card is a picture of a person, not a signed document, so the freshest copy
--  is the correct one. (Contrast uc_coordinator_applications, which snapshots
--  deliberately: that one IS a signed attestation and must not drift.)
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists success_stories (
  id           uuid primary key default gen_random_uuid(),

  /* Cascade: a member who leaves takes their stories with them. Publishing a
   * card about someone no longer in the organisation, with nobody able to ask
   * them to take it down, is the wrong default. */
  member_id    uuid not null references membership_members(id) on delete cascade,

  -- ── What they achieved ────────────────────────────────────────────────────
  kind         text not null default 'other'
               check (kind in ('degree', 'job', 'certificate', 'award',
                               'business', 'sports', 'publication', 'other')),
  title        text not null default '',      -- "MSc Computer Science"
  /* Where it happened — university, employer, awarding body. Separate from the
   * title so the card can typeset it differently and so the organisation can
   * one day answer "how many members studied at KIU" without parsing prose. */
  organisation text not null default '',
  description  text not null default '',      -- the member's own few lines
  /* A month is enough. Asking for an exact day invites a guess, and a wrong
   * day printed under someone's name is worse than no day. Stored as a real
   * date pinned to the first of the month so it can be sorted and filtered. */
  achieved_on  date,

  /* Optional evidence — a photograph of the certificate, the convocation, the
   * first day at work. NOT required: a member with no camera and a real
   * achievement should not be second class on this page. */
  image_url    text,

  -- ── Review ────────────────────────────────────────────────────────────────
  status       text not null default 'pending'
               check (status in ('pending', 'published', 'changes_requested',
                                 'rejected', 'unpublished')),
  /* Shown to the MEMBER. Sending something back with no reason leaves a person
   * who shared good news with nothing to act on, and they will not submit
   * again. */
  review_note  text not null default '',
  reviewed_by  text,
  reviewed_at  timestamptz,

  /* Featured stories lead the public page. A flag rather than a sort column
   * because "is this one of the ones we are highlighting" is a yes/no the
   * committee actually asks. */
  featured     boolean not null default false,

  submitted_at timestamptz not null default now(),
  published_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

/* The public page reads exactly this: published, newest first, featured on
 * top. An index matching the real query rather than a general one. */
create index if not exists idx_success_public
  on success_stories (status, featured desc, achieved_on desc nulls last, published_at desc);

-- The member's own list, and the "have you already got one pending" check.
create index if not exists idx_success_member on success_stories (member_id, created_at desc);

-- The admin queue opens on what is waiting.
create index if not exists idx_success_review on success_stories (status, submitted_at desc);

/* At most THREE stories awaiting review per member.
 *
 * Not a cap on achievements — a member may have any number published. It stops
 * one person filling the review queue faster than a volunteer committee can
 * empty it, which is the failure mode that makes a review queue get abandoned
 * and then ignored entirely.
 *
 * Enforced in the route rather than here: expressing "count of pending rows
 * per member" as a constraint needs a trigger, and a trigger that silently
 * rejects a member's good news is harder to give a kind error message for. */

alter table success_stories enable row level security;

-- ════════════════════════════════════════════════════════════════════════════
--  One new table and three indexes. Nothing existing is altered or deleted,
--  and the file is safe to run twice.
-- ════════════════════════════════════════════════════════════════════════════
