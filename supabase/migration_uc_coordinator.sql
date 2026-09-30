-- ============================================================================
--  TNR — Union Council Coordinator recruitment
--  Run once in the Supabase SQL editor.
--
--  HOW THIS DIFFERS FROM CEC RECRUITMENT, AND WHY IT IS A SEPARATE TABLE
--
--  cec_applications is open to the public: anyone with the link may apply, so
--  it carries its own name, email and phone columns because the applicant may
--  not be anyone TNR knows.
--
--  This one is the opposite. Only an existing, active member may apply, and
--  every personal detail on the form is already on their membership record.
--  Reusing the CEC table would have meant a public form pretending to be a
--  members-only one, with a photo and five long essays required that this
--  process does not ask for.
--
--  WHY THE DETAILS ARE COPIED HERE RATHER THAN READ LIVE FROM THE MEMBER
--
--  The applicant ticks a box confirming "the information provided above is
--  accurate". If this table stored only member_id and the review screen read
--  the member record live, then a member who moves house in November silently
--  rewrites what they attested to in September — and the committee reviewing
--  it would have no way to know. A commitment is a statement made at a moment,
--  so the moment is recorded.
--
--  It also means an application stays readable if a member record is later
--  suspended or removed, which is exactly when a committee most needs to see
--  what was submitted.
-- ============================================================================

-- ── 1. The recruitment round ────────────────────────────────────────────────
/* ONE open call covering every Union Council, per the organisation's decision.
 *
 * A table rather than a settings row because rounds repeat: next year's call
 * is a new row, and last year's applications stay attached to the round they
 * belong to instead of piling into one undated heap. */
create table if not exists uc_coordinator_rounds (
  id          uuid primary key default gen_random_uuid(),
  title       text not null default 'TNR Union Council Coordinator',
  summary     text not null default '',
  -- draft: nobody sees it. open: accepting. closed: visible, not accepting.
  status      text not null default 'draft'
              check (status in ('draft', 'open', 'closed')),
  closes_on   date,
  /* The announcement this round published on the public site, so closing the
   * round can retire the exact row it created. Without this the site goes on
   * advertising a call that has closed, and somebody has to remember which
   * announcement to delete. */
  announcement_id uuid,
  opened_by   text not null default '',
  opened_at   timestamptz,
  closed_at   timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

/* At most one round open at a time.
 *
 * A partial unique index on a constant: every row with status 'open' collides
 * on the same key, so the second one is refused by the database. Two open
 * calls would mean members applying to whichever they happened to open, and a
 * committee reconciling two lists by hand. */
create unique index if not exists uc_rounds_one_open
  on uc_coordinator_rounds ((status)) where status = 'open';

-- ── 2. Applications ─────────────────────────────────────────────────────────
create table if not exists uc_coordinator_applications (
  id           uuid primary key default gen_random_uuid(),
  round_id     uuid not null references uc_coordinator_rounds(id) on delete cascade,
  /* The member as a reference AND as a snapshot below.
   *
   * The reference is how the committee opens the full profile and how the role
   * is changed afterwards in Membership; the snapshot is what was true on the
   * day. Both are needed — neither replaces the other. */
  member_id    uuid not null references membership_members(id) on delete cascade,
  reference_no text unique,

  -- ── Snapshot of the member record, taken at submission ────────────────────
  /* Written by the server from the member's own record. The browser sends none
   * of this: a form that posts its own "membership_id" is a form where the
   * applicant chooses their membership number. */
  full_name          text not null default '',
  membership_id      text not null default '',
  union_council      text not null default '',
  permanent_address  text not null default '',
  current_residence  text not null default '',
  whatsapp           text not null default '',
  email              text not null default '',
  education          text not null default '',
  profession         text not null default '',

  -- ── The one thing the member actually writes ──────────────────────────────
  motivation   text not null default '',

  /* The commitment, and the wording that was on screen when it was ticked.
   *
   * Storing the text — not just `true` — means that when the statement is
   * reworded next year, this year's applications still show what this year's
   * applicants actually agreed to. A boolean alone quietly re-attributes the
   * new wording to everyone who ever applied. */
  commitment_accepted boolean not null default false,
  commitment_text     text not null default '',
  submitted_at        timestamptz not null default now(),

  -- ── Review ───────────────────────────────────────────────────────────────
  status       text not null default 'new'
               check (status in ('new', 'shortlisted', 'interviewed',
                                 'selected', 'not_selected', 'withdrawn')),
  admin_notes  text not null default '',
  reviewed_by  text not null default '',
  reviewed_at  timestamptz,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

/* One application per member per round.
 *
 * Enforced here and not only in the route, because the commonest cause of a
 * duplicate is a double-tap on Submit on a slow connection — two requests in
 * flight at once, both passing an application-level "have you already applied"
 * check before either has written a row. Only the database can settle that. */
create unique index if not exists uc_apps_once
  on uc_coordinator_applications (round_id, member_id);

create index if not exists uc_apps_review
  on uc_coordinator_applications (round_id, status, created_at desc);
/* The committee reads this list grouped by Union Council — that is the whole
 * point of a UC-level recruitment — so the index matches how it is read. */
create index if not exists uc_apps_by_uc
  on uc_coordinator_applications (round_id, union_council);

-- Reference numbers: TNR-UCC-0001. A tracking handle, not a register position,
-- so gaps from an abandoned submission are fine.
create sequence if not exists uc_coordinator_seq start 1;

-- ── 3. Row level security ───────────────────────────────────────────────────
/* Enabled with no policies, exactly as the rest of the platform does it.
 *
 * Every read and write goes through a server route holding the service-role
 * key, which bypasses RLS entirely — so these statements grant nothing. What
 * they do is close the anon key off completely, so a browser that gets hold of
 * the public key cannot read one member's application, let alone all of them.
 * The real access control is requireMember and requireAdmin in the routes. */
alter table uc_coordinator_rounds       enable row level security;
alter table uc_coordinator_applications enable row level security;

-- ============================================================================
--  Two new tables and one sequence. Nothing existing is altered, no data is
--  touched, and the file is safe to run twice.
-- ============================================================================
