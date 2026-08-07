-- ═══════════════════════════════════════════════════════════════════════
-- TNR MEMBERSHIP — PHASE 3: extended professional profile
-- Separate from the original application data (which stays immutable).
-- Election tables untouched.
-- ═══════════════════════════════════════════════════════════════════════
begin;

-- ─── One extended profile per member ───────────────────────────────────
create table if not exists member_profiles (
  member_id     uuid primary key references membership_members(id) on delete cascade,
  headline      text,
  summary       text,
  country       text,
  city          text,
  address       text,
  whatsapp      text,
  linkedin_url  text,
  portfolio_url text,
  github_url    text,
  tnr_contributions text,
  awards        text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ─── Repeatable sections ───────────────────────────────────────────────
create table if not exists member_education (
  id           uuid primary key default gen_random_uuid(),
  member_id    uuid not null references membership_members(id) on delete cascade,
  qualification text,
  degree       text,
  field_of_study text,
  institution  text,
  start_date   date,
  end_date     date,
  currently_studying boolean default false,
  grade        text,
  description  text,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists idx_med_member on member_education(member_id);

create table if not exists member_experience (
  id           uuid primary key default gen_random_uuid(),
  member_id    uuid not null references membership_members(id) on delete cascade,
  job_title    text,
  organization text,
  employment_type text,
  location     text,
  start_date   date,
  end_date     date,
  currently_working boolean default false,
  responsibilities text,
  achievements text,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists idx_mex_member on member_experience(member_id);

create table if not exists member_skills (
  id         uuid primary key default gen_random_uuid(),
  member_id  uuid not null references membership_members(id) on delete cascade,
  name       text not null,
  category   text,                      -- technical | professional | tool
  level      text,                      -- Beginner | Intermediate | Advanced | Expert
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_msk_member on member_skills(member_id);

create table if not exists member_projects (
  id           uuid primary key default gen_random_uuid(),
  member_id    uuid not null references membership_members(id) on delete cascade,
  name         text not null,
  description  text,
  technologies text,
  project_url  text,
  github_url   text,
  image_url    text,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists idx_mpr_member on member_projects(member_id);

create table if not exists member_certifications (
  id            uuid primary key default gen_random_uuid(),
  member_id     uuid not null references membership_members(id) on delete cascade,
  name          text not null,
  issuer        text,
  issue_date    date,
  expiry_date   date,
  credential_id text,
  credential_url text,
  file_url      text,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists idx_mcert_member on member_certifications(member_id);

create table if not exists member_languages (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references membership_members(id) on delete cascade,
  language    text not null,
  proficiency text,                    -- Basic | Conversational | Fluent | Native
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists idx_mlang_member on member_languages(member_id);

create table if not exists member_volunteer_experience (
  id           uuid primary key default gen_random_uuid(),
  member_id    uuid not null references membership_members(id) on delete cascade,
  role         text,
  organization text,
  area         text,
  start_date   date,
  end_date     date,
  currently_active boolean default false,
  description  text,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists idx_mvol_member on member_volunteer_experience(member_id);

-- ─── Sensitive changes require admin approval ──────────────────────────
create table if not exists profile_update_requests (
  id            uuid primary key default gen_random_uuid(),
  member_id     uuid not null references membership_members(id) on delete cascade,
  field         text not null,
  current_value text,
  requested_value text,
  reason        text,
  status        text not null default 'pending',   -- pending | approved | rejected
  reviewed_by   text,
  reviewed_at   timestamptz,
  admin_note    text,
  created_at    timestamptz not null default now(),
  constraint chk_pur_status check (status in ('pending','approved','rejected'))
);
create index if not exists idx_pur_status on profile_update_requests(status);
create index if not exists idx_pur_member on profile_update_requests(member_id);

-- ─── RLS: locked; all access through server routes (service role) ──────
alter table member_profiles              enable row level security;
alter table member_education             enable row level security;
alter table member_experience            enable row level security;
alter table member_skills                enable row level security;
alter table member_projects              enable row level security;
alter table member_certifications        enable row level security;
alter table member_languages             enable row level security;
alter table member_volunteer_experience  enable row level security;
alter table profile_update_requests      enable row level security;

commit;
