-- ═══════════════════════════════════════════════════════════════════════
-- TNR MEMBERSHIP — PHASE 5: cards, certificates, QR verification, directory
-- Election tables untouched.
-- ═══════════════════════════════════════════════════════════════════════
begin;

create table if not exists membership_certificates (
  id            uuid primary key default gen_random_uuid(),
  member_id     uuid not null references membership_members(id) on delete cascade,
  certificate_no text not null unique,          -- TNR-CERT-2026-000001
  type          text not null default 'membership',
  title         text,
  issued_at     timestamptz not null default now(),
  issued_by     text,
  revoked_at    timestamptz,
  revoke_reason text,
  created_at    timestamptz not null default now()
);
create index if not exists idx_cert_member on membership_certificates(member_id);

-- Public verification hits (rate-limit + abuse monitoring)
create table if not exists certificate_verifications (
  id         uuid primary key default gen_random_uuid(),
  lookup     text,
  found      boolean,
  ip         text,
  created_at timestamptz not null default now()
);
create index if not exists idx_cv_created on certificate_verifications(created_at desc);

create sequence if not exists membership_cert_seq start 1;

alter table membership_certificates     enable row level security;
alter table certificate_verifications   enable row level security;

commit;
