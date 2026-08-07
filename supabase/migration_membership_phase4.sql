-- ═══════════════════════════════════════════════════════════════════════
-- TNR MEMBERSHIP — PHASE 4: CV Builder & Cover Letter Builder
-- CV content is stored as JSON so a member can edit their CV without
-- altering the master profile. Election tables untouched.
-- ═══════════════════════════════════════════════════════════════════════
begin;

create table if not exists cv_documents (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references membership_members(id) on delete cascade,
  title       text not null default 'My CV',
  template    text not null default 'modern',
  content     jsonb not null default '{}'::jsonb,   -- editable snapshot
  visible_sections text[] default array[
    'summary','education','experience','skills','projects',
    'certifications','languages','volunteer','awards'],
  section_order text[],
  show_photo  boolean not null default true,
  is_default  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_cv_member on cv_documents(member_id, updated_at desc);

create table if not exists cover_letters (
  id            uuid primary key default gen_random_uuid(),
  member_id     uuid not null references membership_members(id) on delete cascade,
  cv_id         uuid references cv_documents(id) on delete set null,
  title         text not null default 'Cover Letter',
  template      text not null default 'professional',
  target_position text,
  company       text,
  hiring_manager text,
  company_address text,
  job_description text,
  relevant_skills text,
  relevant_experience text,
  opening       text,
  body          text,
  closing       text,
  sign_off      text default 'Sincerely',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_cl_member on cover_letters(member_id, updated_at desc);

alter table cv_documents  enable row level security;
alter table cover_letters enable row level security;

commit;
