-- ════════════════════════════════════════════════════════════════════════════
-- Smart membership duplicate detection
--
-- Finds people who register more than once using a different Gmail address and
-- a different mobile number each time. Email and mobile already carry unique
-- indexes, so this covers the case those cannot: the same person with entirely
-- new contact details.
--
-- WHAT THIS MIGRATION DOES NOT DO, deliberately:
--   • It does not add a single column to membership_applications or
--     membership_members, and it does not alter one row of either. Detection
--     results live in their own table; the records being compared are
--     untouched.
--   • It adds no new mandatory field to the registration form. No father's
--     name, no CNIC, no date-of-birth requirement, no biometrics.
--   • It creates no unique constraint and no trigger that could block a
--     registration. A flag is a note for a human, never a gate.
--
-- Safe to run more than once.
-- ════════════════════════════════════════════════════════════════════════════

-- ── The flags ───────────────────────────────────────────────────────────────
--
-- One row per PAIR of records that scored high enough to be worth a look.
--
-- A pair, not a person: "these two records may be the same human being" is the
-- claim, and it stays reviewable in that shape. Marking a person as a
-- duplicate would need somewhere to put the verdict on the member record, and
-- that is exactly the kind of write this system must not make on its own.
create table if not exists membership_duplicate_flags (
  id                uuid primary key default gen_random_uuid(),

  /* The two sides. Either can be an application or an existing member, so both
     are stored as a kind plus an id rather than as two foreign keys.

     NOT a foreign key on purpose: an admin may legitimately delete a member or
     an application while a flag referencing it is still open, and a cascade
     would silently erase the evidence of why the deletion happened. The
     service tolerates a dangling side and the UI shows it as "record removed". */
  left_kind         text not null,
  left_id           uuid not null,
  right_kind        text not null,
  right_id          uuid not null,

  /* Stable ordering key, so the same pair can never be stored twice in
     opposite order — see the unique index below. */
  pair_key          text not null,

  score             int  not null,
  risk              text not null,
  coverage          int  not null,     -- how much of the 100 points was comparable
  name_similarity   numeric(4,3),
  /* The breakdown that produced the score: which field matched, how closely,
     and what it contributed. An admin refusing somebody's membership partly on
     this number needs to be able to see the working, and a score with no
     reasons is not reviewable. */
  reasons           jsonb not null default '[]'::jsonb,
  detector_version  int  not null default 1,

  /* Review. 'open' until a human decides; nothing here changes by itself. */
  review_status     text not null default 'open',
  reviewed_by       text,
  reviewed_at       timestamptz,
  review_note       text,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint chk_dup_left_kind  check (left_kind  in ('application', 'member')),
  constraint chk_dup_right_kind check (right_kind in ('application', 'member')),
  constraint chk_dup_risk       check (risk in ('possible', 'high')),
  constraint chk_dup_score      check (score between 0 and 100),
  constraint chk_dup_review     check (review_status in
                                 ('open', 'confirmed_duplicate', 'not_duplicate', 'dismissed')),
  /* A record is never a duplicate of itself. */
  constraint chk_dup_distinct   check (left_id <> right_id or left_kind <> right_kind)
);

-- One flag per pair, whichever order the pair was discovered in.
create unique index if not exists uq_dup_pair
  on membership_duplicate_flags (pair_key);

-- The admin queue: open flags, worst first.
create index if not exists idx_dup_open
  on membership_duplicate_flags (review_status, score desc)
  where review_status = 'open';

-- "Does this record already have a flag?" — asked on every registration.
create index if not exists idx_dup_left  on membership_duplicate_flags (left_kind, left_id);
create index if not exists idx_dup_right on membership_duplicate_flags (right_kind, right_id);

-- ── Review history ──────────────────────────────────────────────────────────
--
-- Every verdict, kept even if the verdict is later changed. A flag carries only
-- its CURRENT state; without this, an admin could mark a pair as not-duplicate,
-- a second admin could reverse it, and the first decision would vanish.
create table if not exists membership_duplicate_reviews (
  id          uuid primary key default gen_random_uuid(),
  flag_id     uuid not null references membership_duplicate_flags(id) on delete cascade,
  from_status text,
  to_status   text not null,
  note        text,
  reviewed_by text not null,
  ip          text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_dup_reviews_flag
  on membership_duplicate_reviews (flag_id, created_at desc);

-- ── Row level security ──────────────────────────────────────────────────────
--
-- Enabled with NO policy, which denies every anon and authenticated request.
-- The server reaches these tables with the service-role key, which bypasses
-- RLS — so this is the belt to the route guards' braces: if a browser ever got
-- hold of the anon key and asked for this table directly, it would get nothing.
--
-- That matters more here than on most tables. A row in it pairs two named
-- people and asserts they might be the same person — the single most
-- defamatory thing in this database if it leaked.
alter table membership_duplicate_flags   enable row level security;
alter table membership_duplicate_reviews enable row level security;

-- ── Verify ──────────────────────────────────────────────────────────────────
select
  (select count(*) from information_schema.tables
    where table_name = 'membership_duplicate_flags')    as flags_table,
  (select count(*) from information_schema.tables
    where table_name = 'membership_duplicate_reviews')  as reviews_table,
  (select count(*) from pg_indexes
    where tablename = 'membership_duplicate_flags')     as flag_indexes;
