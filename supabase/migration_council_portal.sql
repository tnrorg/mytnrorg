-- ── TNR Advisory Council Professional Profile Portal ──────────────────────
-- Extends the existing leadership_profiles table (do NOT recreate it) and adds
-- the child tables behind the full professional profile.
--
-- Two rules run through the whole schema:
--   1. Contact details are private by default. `show_email` / `show_mobile`
--      default to false, so nothing is exposed until the member opts in.
--   2. Member-supplied records carry an `approved` flag, default false, so an
--      admin sees content before the public does.
-- Safe to run more than once.

-- ── Profile extensions ────────────────────────────────────────────────────
alter table leadership_profiles
  add column if not exists country          text,
  add column if not exists profession       text,          -- current profession
  add column if not exists organisation     text,          -- employer / university
  add column if not exists tagline          text,          -- professional tagline
  add column if not exists intro            text,          -- 2–3 line card intro
  add column if not exists bio              text,          -- long-form About
  add column if not exists email            text,
  add column if not exists mobile           text,
  add column if not exists show_email       boolean not null default false,
  add column if not exists show_mobile      boolean not null default false,
  add column if not exists verified         boolean not null default false,
  add column if not exists skills           text[]  not null default '{}',
  add column if not exists cv_url           text,
  add column if not exists cv_approved      boolean not null default false,
  add column if not exists research_areas   text[]  not null default '{}',
  add column if not exists accepts_guidance boolean not null default true,
  add column if not exists member_user_id   uuid;          -- links to a login, if any

create index if not exists ix_leadership_country    on leadership_profiles (country);
create index if not exists ix_leadership_profession on leadership_profiles (profession);

-- ── Child records ─────────────────────────────────────────────────────────
-- Same shape throughout: profile_id, ordering, approved flag, timestamps.
create table if not exists council_education (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references leadership_profiles(id) on delete cascade,
  institution text not null, degree text, field_of_study text, country text,
  start_year int, end_year int, grade text, description text,
  sort_order int not null default 0,
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists council_experience (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references leadership_profiles(id) on delete cascade,
  organisation text not null, position text, country text,
  start_year int, end_year int, is_current boolean not null default false,
  responsibilities text[] not null default '{}',
  contributions text, sort_order int not null default 0,
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists council_publications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references leadership_profiles(id) on delete cascade,
  title text not null,
  kind text not null default 'article'
    check (kind in ('journal','conference','book','article','thesis','report')),
  venue text, year int, authors text, doi text, url text, pdf_url text,
  abstract text, sort_order int not null default 0,
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists council_certifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references leadership_profiles(id) on delete cascade,
  title text not null, issuer text, issue_date date, credential_id text,
  file_url text, verify_url text, sort_order int not null default 0,
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists council_awards (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references leadership_profiles(id) on delete cascade,
  title text not null, organisation text, year int, description text,
  image_url text, sort_order int not null default 0,
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists council_projects (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references leadership_profiles(id) on delete cascade,
  title text not null,
  kind text not null default 'community'
    check (kind in ('community','social','research','government','tnr')),
  description text, start_year int, end_year int, image_url text, url text,
  sort_order int not null default 0,
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists council_gallery (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references leadership_profiles(id) on delete cascade,
  image_url text not null, caption text, category text, taken_on date,
  sort_order int not null default 0,
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

-- ── Guidance requests ─────────────────────────────────────────────────────
-- Replaces direct messaging: a logged-in member submits a request, the council
-- member accepts/replies/rejects. No contact detail changes hands unless the
-- council member has chosen to publish it.
create table if not exists council_guidance_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references leadership_profiles(id) on delete cascade,
  membership_id text not null,              -- requesting TNR member
  requester_name text,
  subject text not null,
  category text,
  message text not null,
  preferred_contact text,                   -- email | whatsapp | call | in_app
  attachment_url text,
  status text not null default 'pending'
    check (status in ('pending','accepted','replied','rejected','completed')),
  reply text,
  replied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ix_guidance_profile on council_guidance_requests (profile_id, status);
create index if not exists ix_guidance_member  on council_guidance_requests (membership_id);

-- Every table is served through server routes using the service role, so no
-- public policies are granted.
alter table council_education         enable row level security;
alter table council_experience        enable row level security;
alter table council_publications      enable row level security;
alter table council_certifications    enable row level security;
alter table council_awards            enable row level security;
alter table council_projects          enable row level security;
alter table council_gallery           enable row level security;
alter table council_guidance_requests enable row level security;
