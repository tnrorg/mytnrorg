-- Editable content for the digital membership card.
-- A single row (id = 1) so the admin screen always edits the same record.
-- Safe to run more than once.

create table if not exists card_settings (
  id              int primary key default 1 check (id = 1),
  org_line1       text not null default 'TEHREEK-E-NOJAWANAN',
  org_line2       text not null default 'ROUNDU',
  card_label      text not null default 'DIGITAL MEMBERSHIP CARD',
  signatory_title text not null default 'CENTRAL PRESIDENT',
  signature_note  text not null default 'AUTHORIZED SIGNATURE',
  signature_url   text,                       -- uploaded signature image
  footer_tagline  text not null default 'PROUD TO SERVE ROUNDU',
  about_heading   text not null default 'ABOUT TNR',
  about_text      text not null default 'Tehreek-e-Nojawanan Roundu is a youth-led organization committed to education, unity, responsible leadership, community development, and a better future for Roundu.',
  benefits_heading text not null default 'MEMBER BENEFITS',
  benefits        text[] not null default array[
    'Participation in TNR programs and events',
    'Volunteer opportunities',
    'Leadership development',
    'Community welfare initiatives',
    'Access to jobs and scholarships',
    'Voting rights where eligible'
  ],
  website         text not null default 'www.tnroundu.org',
  email           text not null default 'info@tnroundu.org',
  phone           text not null default '+92 300 1234567',
  verify_label    text not null default 'VERIFIED TNR MEMBER',
  scan_label      text not null default 'SCAN TO VERIFY',
  updated_at      timestamptz not null default now()
);

insert into card_settings (id) values (1) on conflict (id) do nothing;

alter table card_settings enable row level security;
