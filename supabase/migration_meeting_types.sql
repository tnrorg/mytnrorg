-- ============================================================================
--  TNR — Seminar, and a write-your-own meeting type
--  Run once in the Supabase SQL editor.
--
--  WHY THIS IS REQUIRED, NOT OPTIONAL
--
--  meetings.meeting_type carries a CHECK constraint listing the eight types
--  that existed when the module was built:
--
--    check (meeting_type in ('general','executive','advisory','department',
--                            'interview','training','workshop','special'))
--
--  Postgres enforces that on every insert and update. Until this file runs,
--  choosing Seminar or Other in the scheduler fails at the database with a
--  constraint violation — the form shows an error and the meeting is not
--  saved. Shipping the two options without this migration would look exactly
--  like the feature being broken.
--
--  WHAT IT DOES
--    1. Widens the constraint to include 'seminar' and 'other'.
--    2. Adds meeting_type_other, where the organiser's own wording is kept.
-- ============================================================================

-- ── 1. The new column ──────────────────────────────────────────────────────
/* Nullable, and only ever read when meeting_type = 'other'. Sixty characters
 * is a label, not a description — the agenda field is where detail belongs,
 * and a type long enough to wrap breaks every table it appears in. */
alter table public.meetings
  add column if not exists meeting_type_other varchar(60);

-- ── 2. Widen the type constraint ───────────────────────────────────────────
/* Dropped and recreated, because a CHECK cannot be altered in place. The two
 * statements run inside one implicit transaction, so the table is never left
 * without the constraint: if the ADD fails, the DROP rolls back with it. */
alter table public.meetings
  drop constraint if exists meetings_meeting_type_check;

alter table public.meetings
  add constraint meetings_meeting_type_check
  check (meeting_type in ('general','executive','advisory','department',
                          'interview','training','workshop','seminar',
                          'special','other'));

-- ── 3. 'Other' must carry its wording ──────────────────────────────────────
/* The application validates this too, but the application is not the only way
 * rows arrive — an import or a hand-written SQL fix bypasses it entirely. A
 * row with type 'other' and no text displays as "Meeting" everywhere, which
 * is a silent loss of the very thing the person typed.
 *
 * NOT VALID means existing rows are left alone and only new writes are
 * checked. There should be no 'other' rows yet, but a migration that refuses
 * to run because of one bad legacy row helps nobody. */
alter table public.meetings
  drop constraint if exists meetings_other_needs_label;

alter table public.meetings
  add constraint meetings_other_needs_label
  check (
    meeting_type <> 'other'
    or (meeting_type_other is not null and length(btrim(meeting_type_other)) >= 3)
  ) not valid;

-- ============================================================================
--  One nullable column and two constraint changes. No data is altered or
--  deleted, every existing meeting keeps its type, and the file is safe to
--  run twice.
-- ============================================================================
