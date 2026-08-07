-- ═══════════════════════════════════════════════════════════════════════
-- TNR MEMBERSHIP — PHASE 2: member authentication
-- Adds credential + invite columns to membership_members. Nothing else changes.
-- Election tables untouched.
-- ═══════════════════════════════════════════════════════════════════════
begin;

alter table membership_members add column if not exists password_hash    text;
alter table membership_members add column if not exists invite_token      text;
alter table membership_members add column if not exists invite_expires_at timestamptz;
alter table membership_members add column if not exists invite_sent_at    timestamptz;
alter table membership_members add column if not exists password_set_at   timestamptz;
alter table membership_members add column if not exists last_login_at     timestamptz;
alter table membership_members add column if not exists session_epoch     int not null default 0;  -- bump = logout everywhere

create index if not exists idx_mm_invite on membership_members(invite_token);

-- Member notifications (used from phase 2 onward)
create table if not exists membership_notifications (
  id         uuid primary key default gen_random_uuid(),
  member_id  uuid not null references membership_members(id) on delete cascade,
  title      text not null,
  body       text,
  link       text,
  category   text default 'general',
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_mn_member on membership_notifications(member_id, read_at);
alter table membership_notifications enable row level security;

commit;
