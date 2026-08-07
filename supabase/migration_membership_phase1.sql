-- ═══════════════════════════════════════════════════════════════════════
-- TNR MEMBERSHIP MODULE — PHASE 1
-- Core: applications, members, reference data, status history, settings, audit.
--
-- NON-REGRESSION: the election system owns `members`, `votes`, `elections`,
-- `candidates`, `unions`, `audit_logs`. NOTHING here touches them. Every
-- membership table is prefixed `membership_*` and is completely separate.
-- Safe to run on the live database while an election is active.
-- ═══════════════════════════════════════════════════════════════════════

begin;

-- ─── Reference data ────────────────────────────────────────────────────
create table if not exists membership_categories (
  id          serial primary key,
  name        text not null unique,
  description text,
  sort_order  int not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists union_councils (
  id         serial primary key,
  name       text not null unique,
  sort_order int not null default 0,
  active     boolean not null default true
);

create table if not exists villages (
  id              serial primary key,
  name            text not null,
  union_council_id int references union_councils(id) on delete set null,
  active          boolean not null default true,
  unique (name, union_council_id)
);

-- ─── Applications (public submissions) ─────────────────────────────────
create table if not exists membership_applications (
  id                uuid primary key default gen_random_uuid(),
  reference_no      text not null unique,          -- TNR-APP-2026-000001

  -- Section A: personal
  first_name        text not null,
  last_name         text not null,
  full_name         text generated always as (trim(first_name || ' ' || last_name)) stored,
  gender            text,
  age               int,
  village           text,
  union_council     text,
  mobile            text not null,
  mobile_normalized text not null,
  email             text not null,
  email_normalized  text not null,
  photo_url         text,

  -- Section B: education / profession
  education_level   text,
  field_of_study    text,
  current_position  text,

  -- Section C: motivation
  why_join          text,
  contribution_areas text[],
  leadership_view   text,                          -- Yes | No | Not Sure
  leadership_note   text,
  youth_issues      text,

  -- Section D: declaration
  declaration_accepted boolean not null default false,
  declaration_version  text,
  declaration_at       timestamptz,
  submitted_ip         text,
  submitted_user_agent text,

  -- Section E: WhatsApp opt-in
  whatsapp_opt_in   boolean not null default false,

  -- Workflow
  status            text not null default 'pending_review',
  admin_message     text,
  admin_notes       text,
  reviewed_by       text,
  reviewed_at       timestamptz,
  member_id         uuid,                           -- set once approved

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint chk_app_status check (status in
    ('pending_review','under_review','correction_requested','approved','rejected','withdrawn'))
);
create index if not exists idx_app_status on membership_applications(status);
create index if not exists idx_app_email  on membership_applications(email_normalized);
create index if not exists idx_app_mobile on membership_applications(mobile_normalized);

-- One ACTIVE application per email / mobile (rejected & withdrawn may reapply)
create unique index if not exists uq_app_email_active on membership_applications(email_normalized)
  where status in ('pending_review','under_review','correction_requested','approved');
create unique index if not exists uq_app_mobile_active on membership_applications(mobile_normalized)
  where status in ('pending_review','under_review','correction_requested','approved');

-- ─── Approved members (SEPARATE from election `members`) ───────────────
create table if not exists membership_members (
  id                uuid primary key default gen_random_uuid(),
  membership_id     text not null unique,           -- TNR-2026-000001
  application_id    uuid references membership_applications(id) on delete set null,
  auth_user_id      uuid,                           -- Supabase Auth user (phase 2)

  first_name        text not null,
  last_name         text not null,
  full_name         text generated always as (trim(first_name || ' ' || last_name)) stored,
  gender            text,
  photo_url         text,
  email             text not null,
  email_normalized  text not null unique,
  mobile            text,
  mobile_normalized text,

  village           text,
  union_council     text,
  category_id       int references membership_categories(id) on delete set null,

  education_level   text,
  field_of_study    text,
  current_position  text,
  contribution_areas text[],

  status            text not null default 'active',
  public_visible    boolean not null default false,
  whatsapp_opt_in   boolean not null default false,

  approved_by       text,
  approved_at       timestamptz,
  issued_at         timestamptz,
  expires_at        timestamptz,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,

  constraint chk_member_status check (status in
    ('approved','active','suspended','inactive','expired'))
);
create index if not exists idx_mm_status  on membership_members(status);
create index if not exists idx_mm_public  on membership_members(public_visible, status);
create index if not exists idx_mm_uc      on membership_members(union_council);

-- ─── Status history ────────────────────────────────────────────────────
create table if not exists membership_status_history (
  id            uuid primary key default gen_random_uuid(),
  member_id     uuid references membership_members(id) on delete cascade,
  application_id uuid references membership_applications(id) on delete cascade,
  from_status   text,
  to_status     text not null,
  reason        text,
  changed_by    text,
  created_at    timestamptz not null default now()
);
create index if not exists idx_msh_member on membership_status_history(member_id);

-- ─── Settings (ID format, WhatsApp link, declaration text) ─────────────
create table if not exists membership_settings (
  key         text primary key,
  value       text,
  updated_by  text,
  updated_at  timestamptz not null default now()
);

-- ─── Audit log (separate from election audit_logs) ─────────────────────
create table if not exists membership_audit_logs (
  id            uuid primary key default gen_random_uuid(),
  admin_id      text,
  admin_name    text,
  action        text not null,
  target_type   text,
  target_id     text,
  previous_value jsonb,
  new_value     jsonb,
  reason        text,
  ip            text,
  created_at    timestamptz not null default now()
);
create index if not exists idx_mal_created on membership_audit_logs(created_at desc);

-- ─── Sequence for Membership IDs (server-side, never client) ───────────
create sequence if not exists membership_id_seq start 1;
create sequence if not exists membership_app_ref_seq start 1;

-- ─── Row Level Security: locked down; all access via service role ──────
alter table membership_categories      enable row level security;
alter table union_councils             enable row level security;
alter table villages                   enable row level security;
alter table membership_applications    enable row level security;
alter table membership_members         enable row level security;
alter table membership_status_history  enable row level security;
alter table membership_settings        enable row level security;
alter table membership_audit_logs      enable row level security;

-- Public may READ reference data only (for the application form dropdowns).
drop policy if exists p_uc_read on union_councils;
create policy p_uc_read on union_councils for select using (active = true);
drop policy if exists p_vil_read on villages;
create policy p_vil_read on villages for select using (active = true);
drop policy if exists p_cat_read on membership_categories;
create policy p_cat_read on membership_categories for select using (active = true);
-- No public policies on applications/members/history/settings/audit:
-- every read & write goes through server routes using the service role.

-- ─── Seed defaults ─────────────────────────────────────────────────────
insert into membership_categories (name, sort_order) values
  ('General Member', 1), ('Student Member', 2), ('Professional Member', 3),
  ('Overseas Member', 4), ('Honorary Member', 5)
on conflict (name) do nothing;

insert into membership_settings (key, value) values
  ('membership_id_format', 'TNR-{YYYY}-{000000}'),
  ('application_ref_format', 'TNR-APP-{YYYY}-{000000}'),
  ('declaration_version', 'v1.0'),
  ('whatsapp_group_link', ''),
  ('min_age', '')
on conflict (key) do nothing;

commit;

-- Helper so the server can pull sequence values via RPC.
create or replace function nextval_text(seq_name text)
returns bigint language plpgsql security definer as $$
begin
  return nextval(seq_name::regclass);
end $$;
revoke all on function nextval_text(text) from public, anon, authenticated;
