-- Editable content for the membership certificate (A4 landscape).
-- Mirrors card_settings: a single row (id = 1) so the admin screen always
-- edits the same record. Safe to run more than once.

create table if not exists certificate_settings (
  id                int primary key default 1 check (id = 1),

  -- Masthead
  org_line1         text not null default 'TEHREEK-E-NOJAWANAN ROUNDU',
  org_line2         text not null default 'ROUNDU · GILGIT-BALTISTAN',
  logo_url          text,                    -- falls back to /tnr-logo.png

  -- Title block
  cert_title        text not null default 'Certificate of Membership',
  intro_line        text not null default 'This is to certify that',

  -- Body. Supports tokens, substituted per member when the certificate renders:
  --   {{name}} {{membership_id}} {{village}} {{union_council}} {{member_type}}
  body_text         text not null default
    'bearing Membership ID {{membership_id}} of {{village}}, Union Council {{union_council}}, is a duly registered {{member_type}} of Tehreek-e-Nojawanan Roundu, and is entitled to all rights and privileges of membership.',

  -- Signature block
  signatory_title   text not null default 'Central President',
  signatory_org     text not null default 'Tehreek-e-Nojawanan Roundu',
  signature_url     text,                    -- uploaded signature image

  -- Footer / QR
  scan_label        text not null default 'SCAN TO VERIFY',
  issued_label      text not null default 'Issued on',

  -- Presentation
  accent_gold       text not null default '#C9A227',
  accent_green      text not null default '#0B3D2E',
  show_border       boolean not null default true,
  show_qr           boolean not null default true,

  updated_at        timestamptz not null default now()
);

insert into certificate_settings (id) values (1) on conflict (id) do nothing;

alter table certificate_settings enable row level security;

-- Read-only for anon; all writes go through the service-role key in the API.
do $$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public'
       and tablename  = 'certificate_settings'
       and policyname = 'certificate_settings_read'
  ) then
    create policy certificate_settings_read
      on certificate_settings for select
      using (true);
  end if;
end $$;
