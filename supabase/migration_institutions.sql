-- Educational institutions register — schools, colleges and training centres
-- in Roundu, with the staffing picture for each one.
--
-- The staffing model separates three things that are usually conflated, and
-- that separation is the whole point of the page:
--
--   posted_here        teachers whose FIRST APPOINTMENT posting is this school
--                      — their parent station on paper
--   serving_here       of those, how many actually turn up and teach here
--   serving_elsewhere  posted here on paper, but on duty at another station
--                      or in another city
--   attached_in        posted somewhere else, but actually teaching here
--
-- A school can look fully staffed on paper and be empty in practice. Recording
-- only a single "teachers" number hides exactly that, which is why there are
-- four columns instead of one.
--
-- Safe to run more than once. Touches nothing in the election system.

create table if not exists tnr_institutions (
  id                    uuid primary key default gen_random_uuid(),

  name                  text not null default '',
  -- school | college | training_centre | other
  kind                  text not null default 'school',
  -- primary | middle | high | higher_secondary | degree | vocational | other
  level                 text not null default 'primary',
  -- boys | girls | co_ed
  serves                text not null default 'co_ed',
  -- government | private | community | other
  sector                text not null default 'government',

  union_council         text not null default '',
  village               text not null default '',

  -- ── Staffing ──────────────────────────────────────────────────────────────
  sanctioned_posts      int not null default 0 check (sanctioned_posts >= 0),
  posted_here           int not null default 0 check (posted_here >= 0),
  serving_here          int not null default 0 check (serving_here >= 0),
  serving_elsewhere     int not null default 0 check (serving_elsewhere >= 0),
  attached_in           int not null default 0 check (attached_in >= 0),
  teachers_needed       int not null default 0 check (teachers_needed >= 0),
  community_teachers    int not null default 0 check (community_teachers >= 0),

  -- What families pay, per student per month, to fund community teachers.
  -- numeric rather than a float: this is money residents actually hand over.
  community_fee_monthly numeric(12,2) not null default 0 check (community_fee_monthly >= 0),
  fee_note              text not null default '',

  -- ── Optional context ──────────────────────────────────────────────────────
  students_total        int not null default 0 check (students_total >= 0),
  students_boys         int not null default 0 check (students_boys >= 0),
  students_girls        int not null default 0 check (students_girls >= 0),
  head_teacher          text not null default '',
  contact               text not null default '',

  notes                 text not null default '',
  -- Provenance, for the same reason the projects table has it: a published
  -- figure about a real school needs to say where it came from.
  source                text not null default '',
  last_verified         date,

  image_url             text,
  published             boolean not null default true,
  sort_order            int not null default 0,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists tnr_institutions_public_idx on tnr_institutions (published, sort_order, name);
create index if not exists tnr_institutions_area_idx   on tnr_institutions (union_council, village);

alter table tnr_institutions drop constraint if exists tnr_institutions_kind_check;
alter table tnr_institutions add constraint tnr_institutions_kind_check
  check (kind in ('school', 'college', 'training_centre', 'other'));

alter table tnr_institutions drop constraint if exists tnr_institutions_serves_check;
alter table tnr_institutions add constraint tnr_institutions_serves_check
  check (serves in ('boys', 'girls', 'co_ed'));

alter table tnr_institutions enable row level security;
