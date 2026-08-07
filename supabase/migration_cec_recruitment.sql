-- Executive Committee recruitment — open positions and applications.
--
-- Two tables rather than one form:
--   cec_vacancies     what is actually open, with its own scenario question
--   cec_applications  who applied, and where they are in the review
--
-- The vacancy table is what makes this reusable. Without it, every round means
-- editing code to change which posts are advertised, and nothing closes the
-- form when the deadline passes.
--
-- `scenario_question` lives on the VACANCY because the draft asks a different
-- situational question of each position — the Legal Secretary is asked about a
-- constitutional dispute, the Finance Secretary about a discrepancy in the
-- accounts. Putting it on the application form would mean one shared question
-- and would lose the point of asking it.
--
-- Applications are open to anyone with the link, so this table holds contact
-- details for people who may not be members. Nothing here is ever returned by
-- a public endpoint — the public API reads vacancies only.
--
-- Safe to run more than once. Touches nothing in the election system.

create table if not exists cec_vacancies (
  id                uuid primary key default gen_random_uuid(),
  title             text not null default '',
  seats             int  not null default 1 check (seats >= 1),
  summary           text not null default '',
  scenario_question text not null default '',
  responsibilities  text[] not null default '{}',
  requirements      text[] not null default '{}',
  -- Some posts are reserved, e.g. the female Social Media Coordinator. Stored
  -- as a note rather than a hard filter: the form states it plainly and the
  -- panel decides, instead of the software silently rejecting someone.
  eligibility_note  text not null default '',
  closes_on         date,
  -- draft: not public. open: accepting. closed: visible, not accepting.
  status            text not null default 'open' check (status in ('draft', 'open', 'closed')),
  sort_order        int not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table if not exists cec_applications (
  id               uuid primary key default gen_random_uuid(),
  vacancy_id       uuid references cec_vacancies(id) on delete set null,
  reference_no     text unique,

  -- ── Section 1: Personal information ──────────────────────────────────────
  full_name        text not null default '',
  email            text not null default '',
  mobile           text not null default '',
  education_level  text not null default '',
  current_position text not null default '',
  organisation     text not null default '',

  -- Optional context. Not in the draft, but an application with no idea where
  -- the person is from is hard to shortlist, and an existing member should not
  -- have to be looked up by hand.
  union_council    text not null default '',
  village          text not null default '',
  membership_id    text not null default '',

  -- ── Section 2: Competency and experience ─────────────────────────────────
  relevant_experience text not null default '',

  -- ── Section 3: Analytical and situational ────────────────────────────────
  scenario_answer   text not null default '',
  challenge_answer  text not null default '',
  leadership_answer text not null default '',
  vision_answer     text not null default '',

  cv_url           text,

  declaration_accepted boolean not null default false,

  -- ── Review ───────────────────────────────────────────────────────────────
  status           text not null default 'new'
                     check (status in ('new', 'shortlisted', 'interviewed',
                                       'selected', 'not_selected', 'withdrawn')),
  admin_notes      text not null default '',
  interview_on     timestamptz,
  reviewed_by      text not null default '',
  reviewed_at      timestamptz,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- One application per email per position. A double-tap on Submit, or someone
-- reapplying "to fix a typo", would otherwise leave duplicates for the panel
-- to spot by eye.
create unique index if not exists cec_applications_once
  on cec_applications (vacancy_id, lower(email))
  where email <> '';

create index if not exists cec_applications_status_idx on cec_applications (status, created_at desc);
create index if not exists cec_vacancies_public_idx    on cec_vacancies (status, sort_order);

-- Reference numbers: TNR-CEC-0001. Gaps are fine here — unlike a membership
-- number this is a tracking handle, not a position in a register.
create sequence if not exists cec_application_seq start 1;

-- ── The three positions from the approved draft ──────────────────────────────
insert into cec_vacancies (title, seats, scenario_question, eligibility_note, sort_order)
select * from (values
  ('Legal Secretary', 1,
   'A disagreement arises regarding the interpretation of a clause in the organization''s constitution. How would you resolve the matter while ensuring transparency and fairness?',
   '', 1),
  ('Finance Secretary', 1,
   'You discover an unexplained difference in the organization''s financial records one week before the annual financial report is due. What steps would you take?',
   '', 2),
  ('Social Media Coordinator (Female)', 1,
   'A controversial post about the organization goes viral and begins attracting negative comments. How would you manage the situation while protecting the organization''s reputation?',
   'This position is open to female applicants.', 3)
) as v(title, seats, scenario_question, eligibility_note, sort_order)
where not exists (select 1 from cec_vacancies);

alter table cec_vacancies    enable row level security;
alter table cec_applications enable row level security;
