-- ════════════════════════════════════════════════════════════════════════════
-- University Ambassador portal
--
-- Gives each University Ambassador a scoped view of the TNR members at the
-- university (and optionally the campus) they are assigned to.
--
-- WHAT THIS ADDS
--   tnr_universities                  one row per institution, stable text id
--   tnr_university_aliases            every accepted spelling → one university
--   tnr_university_campuses           campuses, created by admins as needed
--   membership_members.university_id  + campus, source, mapped_at
--   university_ambassador_assignments who may see which university/campus
--   university_member_followups       current follow-up status per member
--   university_member_notes           internal coordination notes
--   university_ambassador_activity    audit trail of everything ambassadors do
--
-- WHAT THIS DOES NOT DO
--   • No second membership table. Members stay in membership_members; the
--     portal reads them where they are.
--   • organization_name is not touched. It stays exactly what the member typed.
--     The id sits beside it, so nothing they wrote is lost or rewritten.
--   • The registration form and the approval route are unchanged — the trigger
--     below does the mapping wherever and however a member row is written.
--
-- Safe to run more than once. Run AFTER migration_address_organization.sql
-- (which adds organization_name to membership_members).
-- ════════════════════════════════════════════════════════════════════════════

-- ── Universities ────────────────────────────────────────────────────────────
create table if not exists tnr_universities (
  id          text primary key,
  name        text not null,
  province    text,
  country     text not null default 'Pakistan',
  source      text not null default 'seed',      -- seed | admin
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint chk_uni_id     check (id ~ '^[a-z0-9][a-z0-9-]{1,119}$'),
  constraint chk_uni_source check (source in ('seed', 'admin'))
);

/* One alias maps to ONE university, enforced by the primary key.
 *
 * This is the database half of the rule "an alias that could mean two
 * universities means neither". The seed never inserts an ambiguous alias, and
 * an admin who later adds a university whose name collides with an existing
 * alias is refused rather than allowed to create a spelling that silently
 * routes members to whichever row happened to be inserted first. */
create table if not exists tnr_university_aliases (
  alias_norm     text primary key,
  university_id  text not null references tnr_universities(id) on delete cascade,
  source         text not null default 'seed'
);
create index if not exists idx_uni_alias_uni on tnr_university_aliases (university_id);

create table if not exists tnr_university_campuses (
  id             uuid primary key default gen_random_uuid(),
  university_id  text not null references tnr_universities(id) on delete cascade,
  name           text not null,
  created_by     text,
  created_at     timestamptz not null default now(),
  constraint chk_campus_name check (length(trim(name)) between 2 and 120)
);
create unique index if not exists uq_campus_name
  on tnr_university_campuses (university_id, lower(trim(name)));

-- ── Normalisation ───────────────────────────────────────────────────────────
--
-- MUST stay equivalent to normUni() in lib/edu/pakistanUniversities.js. The
-- seed is normalised in JavaScript and looked up here, so if the two ever
-- disagree a spelling that the seed recorded simply stops matching.
--
-- lowercase → "&" to "and" → drop apostrophes → anything not a-z/0-9 becomes a
-- single space → trim → drop one leading "the ".
create or replace function tnr_norm_university(t text)
returns text language sql immutable as $$
  select nullif(
    regexp_replace(
      trim(regexp_replace(
        replace(replace(replace(lower(coalesce(t, '')), '&', ' and '), '''', ''), '’', ''),
        '[^a-z0-9]+', ' ', 'g')),
      '^the ', ''),
    '')
$$;

/* Exact alias lookup. NO fuzzy matching, deliberately: a near-miss mapped to
 * the wrong university shows a member's record to a stranger at another
 * institution, while a miss only leaves them unmatched for an admin. */
create or replace function tnr_resolve_university(t text)
returns text language sql stable as $$
  select a.university_id
    from tnr_university_aliases a
    join tnr_universities u on u.id = a.university_id and u.active
   where a.alias_norm = tnr_norm_university(t)
$$;

-- ── Member columns ──────────────────────────────────────────────────────────
alter table membership_members
  add column if not exists university_id        text references tnr_universities(id) on delete set null;
alter table membership_members
  add column if not exists university_campus_id uuid references tnr_university_campuses(id) on delete set null;
-- 'auto' = matched from what the member typed; 'admin' = set by an admin.
alter table membership_members
  add column if not exists university_source    text;
alter table membership_members
  add column if not exists university_mapped_at timestamptz;

alter table membership_members drop constraint if exists chk_mm_university_source;
alter table membership_members add constraint chk_mm_university_source
  check (university_source is null or university_source in ('auto', 'admin'));

create index if not exists idx_mm_university
  on membership_members (university_id, university_campus_id)
  where deleted_at is null and university_id is not null;

-- ── Live synchronisation ────────────────────────────────────────────────────
--
-- Fires on EVERY insert and update of a member row, which is the point: the
-- approval route, the member's own profile save and any admin edit all write
-- this table, and none of them needs to know this exists.
--
-- Re-resolves only when the NORMALISED name changes, so retyping
-- "COMSATS " as "COMSATS" does not throw away a campus or an admin's mapping.
-- When the member genuinely changes university, their old campus is cleared —
-- it belonged to the old institution — and their ambassador visibility moves
-- with them on the very next request, because every portal query filters on
-- this column rather than on a copy of it.
create or replace function tnr_members_university_sync()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT'
     or tnr_norm_university(new.organization_name)
        is distinct from tnr_norm_university(old.organization_name) then
    new.university_id        := tnr_resolve_university(new.organization_name);
    new.university_source    := case when new.university_id is null then null else 'auto' end;
    new.university_mapped_at := now();
  end if;

  /* A campus must belong to the member's university — whoever set it. Checked
     on every write, so neither a stale campus nor a hand-edited mismatch can
     leave a member visible to a campus ambassador of a different university. */
  if new.university_campus_id is not null and not exists (
       select 1 from tnr_university_campuses c
        where c.id = new.university_campus_id
          and c.university_id is not distinct from new.university_id) then
    new.university_campus_id := null;
  end if;

  return new;
end $$;

drop trigger if exists trg_members_university_sync on membership_members;
create trigger trg_members_university_sync
  before insert or update on membership_members
  for each row execute function tnr_members_university_sync();

/* Re-run matching across the roll — after the seed, and whenever an admin adds
 * a university or an alias. Never overrides a mapping an admin set by hand. */
create or replace function tnr_remap_universities()
returns integer language plpgsql as $$
declare n integer;
begin
  update membership_members m
     set university_id        = r.uid,
         university_source    = case when r.uid is null then null else 'auto' end,
         university_mapped_at = now()
    from (select id, tnr_resolve_university(organization_name) as uid
            from membership_members
           where coalesce(university_source, 'auto') <> 'admin') r
   where m.id = r.id
     and m.university_id is distinct from r.uid;
  get diagnostics n = row_count;
  return n;
end $$;

-- ── Ambassador assignments ──────────────────────────────────────────────────
--
-- The ROLE (university_ambassador) says someone is an ambassador and gives them
-- a public profile. The ASSIGNMENT says which members they may see. Both are
-- checked on every request, so demoting the role revokes portal access at once
-- even if an assignment row is left behind.
--
-- campus_id null = the whole university. A campus-scoped ambassador sees only
-- members an admin has placed on that campus.
--
-- Rows are never deleted on removal — `active` goes false — so the history of
-- who could see whom, and when, survives.
create table if not exists university_ambassador_assignments (
  id                uuid primary key default gen_random_uuid(),
  ambassador_id     uuid not null references membership_members(id) on delete cascade,
  university_id     text not null references tnr_universities(id) on delete cascade,
  campus_id         uuid references tnr_university_campuses(id) on delete cascade,
  /* Off by default. Email and mobile are shown only where an admin has
     explicitly allowed it for this assignment. */
  can_view_contact  boolean not null default false,
  active            boolean not null default true,
  note              text,
  assigned_by       text not null,
  assigned_at       timestamptz not null default now(),
  removed_by        text,
  removed_at        timestamptz
);
create unique index if not exists uq_uaa_active
  on university_ambassador_assignments (ambassador_id, university_id, coalesce(campus_id::text, '*'))
  where active;
create index if not exists idx_uaa_ambassador
  on university_ambassador_assignments (ambassador_id) where active;
create index if not exists idx_uaa_university
  on university_ambassador_assignments (university_id) where active;

-- ── Coordination ────────────────────────────────────────────────────────────
--
-- Keyed by (university, member), NOT by member alone. If a member moves to
-- another university, the notes the old ambassadors wrote stay with the old
-- university: the new ambassador does not inherit someone else's private
-- remarks, and the old ambassador loses sight of the member entirely because
-- the directory filters on the member's CURRENT university.
--
-- Never shown to the member themselves.
create table if not exists university_member_followups (
  university_id  text not null references tnr_universities(id) on delete cascade,
  member_id      uuid not null references membership_members(id) on delete cascade,
  status         text not null default 'none',
  updated_by     uuid references membership_members(id) on delete set null,
  updated_at     timestamptz not null default now(),
  primary key (university_id, member_id),
  constraint chk_umf_status check (status in ('none', 'needs_followup', 'contacted', 'resolved'))
);
create index if not exists idx_umf_open
  on university_member_followups (university_id, status) where status = 'needs_followup';

create table if not exists university_member_notes (
  id             uuid primary key default gen_random_uuid(),
  university_id  text not null references tnr_universities(id) on delete cascade,
  member_id      uuid not null references membership_members(id) on delete cascade,
  author_id      uuid references membership_members(id) on delete set null,
  author_name    text,
  body           text not null,
  created_at     timestamptz not null default now(),
  constraint chk_umn_body check (length(trim(body)) between 1 and 2000)
);
create index if not exists idx_umn_member
  on university_member_notes (university_id, member_id, created_at desc);

-- ── Activity log ────────────────────────────────────────────────────────────
--
-- Every ambassador action: viewing a member's detail, changing a follow-up,
-- writing a note, sending an announcement, raising a request, and every time
-- contact details were shown. Read by admins in the Admin Portal.
create table if not exists university_ambassador_activity (
  id                uuid primary key default gen_random_uuid(),
  ambassador_id     uuid references membership_members(id) on delete set null,
  ambassador_name   text,
  university_id     text,
  action            text not null,
  target_member_id  uuid,
  detail            jsonb not null default '{}'::jsonb,
  ip                text,
  created_at        timestamptz not null default now()
);
create index if not exists idx_uaact_recent
  on university_ambassador_activity (created_at desc);
create index if not exists idx_uaact_amb
  on university_ambassador_activity (ambassador_id, action, created_at desc);

-- ── Requests to administrators ──────────────────────────────────────────────
--
-- Corrections and support requests an ambassador raises about a member (a
-- misspelt name, a wrong university, a member who needs help) or about the
-- university as a whole.
--
-- A table of its own rather than support_tickets: no admin screen reads
-- support_tickets at present, so a request filed there would never be seen.
-- These are read by the University Ambassadors tab in the Admin Portal.
--
-- The ambassador asks; an admin acts. Nothing here edits a member record.
create table if not exists university_ambassador_requests (
  id               uuid primary key default gen_random_uuid(),
  ambassador_id    uuid references membership_members(id) on delete set null,
  ambassador_name  text,
  university_id    text references tnr_universities(id) on delete cascade,
  member_id        uuid references membership_members(id) on delete set null,
  kind             text not null default 'correction',
  subject          text not null,
  message          text not null,
  status           text not null default 'open',
  admin_reply      text,
  handled_by       text,
  handled_at       timestamptz,
  created_at       timestamptz not null default now(),
  constraint chk_uar_kind    check (kind in ('correction', 'support', 'other')),
  constraint chk_uar_status  check (status in ('open', 'in_progress', 'resolved', 'declined')),
  constraint chk_uar_subject check (length(trim(subject)) between 3 and 160),
  constraint chk_uar_message check (length(trim(message)) between 5 and 3000)
);
create index if not exists idx_uar_open
  on university_ambassador_requests (status, created_at desc);
create index if not exists idx_uar_ambassador
  on university_ambassador_requests (ambassador_id, created_at desc);

-- ── Row level security ──────────────────────────────────────────────────────
--
-- Enabled with NO policies: every anon and authenticated request is refused.
--
-- Why not per-university policies keyed on auth.uid()? Because TNR members do
-- not sign in through Supabase Auth — they sign in with TNR's own JWT, so
-- auth.uid() is always null for them and a policy built on it would protect
-- nothing while looking as though it did. The real boundary is the server:
-- every /api/member/university route re-checks the ambassador's role and
-- active assignment and filters on university_id before touching a row. These
-- deny-all policies make sure the anon key in a browser can never go round it.
alter table tnr_universities                  enable row level security;
alter table tnr_university_aliases            enable row level security;
alter table tnr_university_campuses           enable row level security;
alter table university_ambassador_assignments enable row level security;
alter table university_member_followups       enable row level security;
alter table university_member_notes           enable row level security;
alter table university_ambassador_activity    enable row level security;
alter table university_ambassador_requests    enable row level security;

-- ════════════════════════════════════════════════════════════════════════════
-- Seed — generated from lib/edu/pakistanUniversities.js by
-- scripts/gen-university-seed.mjs. Do not edit by hand; edit the list and
-- re-run the script. `on conflict do nothing` so admin edits are never undone.
-- ════════════════════════════════════════════════════════════════════════════
-- BEGIN GENERATED SEED
-- 253 universities, 448 aliases.
insert into tnr_universities (id, name, province) values
  ('karakoram-international-university', 'Karakoram International University', 'Gilgit-Baltistan'),
  ('baltistan-university-skardu', 'Baltistan University, Skardu', 'Gilgit-Baltistan'),
  ('university-of-azad-jammu-and-kashmir', 'University of Azad Jammu and Kashmir', 'AJK'),
  ('mirpur-university-of-science-and-technology', 'Mirpur University of Science and Technology', 'AJK'),
  ('university-of-poonch-rawalakot', 'University of Poonch, Rawalakot', 'AJK'),
  ('university-of-kotli', 'University of Kotli', 'AJK'),
  ('women-university-of-azad-jammu-and-kashmir-bagh', 'Women University of Azad Jammu and Kashmir, Bagh', 'AJK'),
  ('al-khair-university', 'Al-Khair University', 'AJK'),
  ('mohi-ud-din-islamic-university', 'Mohi-ud-Din Islamic University', 'AJK'),
  ('quaid-i-azam-university', 'Quaid-i-Azam University', 'Islamabad'),
  ('national-university-of-sciences-and-technology', 'National University of Sciences and Technology', 'Islamabad'),
  ('comsats-university-islamabad', 'COMSATS University Islamabad', 'Islamabad'),
  ('international-islamic-university-islamabad', 'International Islamic University, Islamabad', 'Islamabad'),
  ('allama-iqbal-open-university', 'Allama Iqbal Open University', 'Islamabad'),
  ('national-university-of-modern-languages', 'National University of Modern Languages', 'Islamabad'),
  ('virtual-university-of-pakistan', 'Virtual University of Pakistan', 'Islamabad'),
  ('pakistan-institute-of-engineering-and-applied-sciences', 'Pakistan Institute of Engineering and Applied Sciences', 'Islamabad'),
  ('national-university-of-computer-and-emerging-sciences', 'National University of Computer and Emerging Sciences', 'Islamabad'),
  ('air-university-islamabad', 'Air University, Islamabad', 'Islamabad'),
  ('bahria-university', 'Bahria University', 'Islamabad'),
  ('riphah-international-university', 'Riphah International University', 'Islamabad'),
  ('capital-university-of-science-and-technology', 'Capital University of Science and Technology', 'Islamabad'),
  ('institute-of-space-technology', 'Institute of Space Technology', 'Islamabad'),
  ('foundation-university-islamabad', 'Foundation University Islamabad', 'Islamabad'),
  ('federal-urdu-university-of-arts-science-and-technology', 'Federal Urdu University of Arts, Science and Technology', 'Islamabad'),
  ('national-defence-university-islamabad', 'National Defence University, Islamabad', 'Islamabad'),
  ('national-university-of-technology', 'National University of Technology', 'Islamabad'),
  ('national-skills-university-islamabad', 'National Skills University, Islamabad', 'Islamabad'),
  ('pakistan-institute-of-development-economics', 'Pakistan Institute of Development Economics', 'Islamabad'),
  ('shaheed-zulfiqar-ali-bhutto-medical-university', 'Shaheed Zulfiqar Ali Bhutto Medical University', 'Islamabad'),
  ('shifa-tameer-e-millat-university', 'Shifa Tameer-e-Millat University', 'Islamabad'),
  ('sir-syed-case-institute-of-technology', 'Sir Syed CASE Institute of Technology', 'Islamabad'),
  ('muslim-youth-university', 'Muslim Youth University', 'Islamabad'),
  ('ibadat-international-university', 'IBADAT International University', 'Islamabad'),
  ('university-of-the-punjab', 'University of the Punjab', 'Punjab'),
  ('university-of-engineering-and-technology-lahore', 'University of Engineering and Technology, Lahore', 'Punjab'),
  ('government-college-university-lahore', 'Government College University, Lahore', 'Punjab'),
  ('lahore-university-of-management-sciences', 'Lahore University of Management Sciences', 'Punjab'),
  ('king-edward-medical-university', 'King Edward Medical University', 'Punjab'),
  ('university-of-health-sciences-lahore', 'University of Health Sciences, Lahore', 'Punjab'),
  ('university-of-veterinary-and-animal-sciences-lahore', 'University of Veterinary and Animal Sciences, Lahore', 'Punjab'),
  ('university-of-education-lahore', 'University of Education, Lahore', 'Punjab'),
  ('university-of-management-and-technology-lahore', 'University of Management and Technology, Lahore', 'Punjab'),
  ('university-of-central-punjab', 'University of Central Punjab', 'Punjab'),
  ('university-of-lahore', 'University of Lahore', 'Punjab'),
  ('information-technology-university-of-the-punjab', 'Information Technology University of the Punjab', 'Punjab'),
  ('forman-christian-college-university', 'Forman Christian College University', 'Punjab'),
  ('kinnaird-college-for-women-university', 'Kinnaird College for Women University', 'Punjab'),
  ('lahore-college-for-women-university', 'Lahore College for Women University', 'Punjab'),
  ('fatima-jinnah-medical-university', 'Fatima Jinnah Medical University', 'Punjab'),
  ('national-college-of-arts', 'National College of Arts', 'Punjab'),
  ('national-college-of-business-administration-and-economics', 'National College of Business Administration and Economics', 'Punjab'),
  ('beaconhouse-national-university', 'Beaconhouse National University', 'Punjab'),
  ('minhaj-university-lahore', 'Minhaj University, Lahore', 'Punjab'),
  ('hajvery-university', 'Hajvery University', 'Punjab'),
  ('qarshi-university', 'Qarshi University', 'Punjab'),
  ('superior-university-lahore', 'Superior University, Lahore', 'Punjab'),
  ('university-of-south-asia', 'University of South Asia', 'Punjab'),
  ('lahore-garrison-university', 'Lahore Garrison University', 'Punjab'),
  ('lahore-school-of-economics', 'Lahore School of Economics', 'Punjab'),
  ('university-of-home-economics-lahore', 'University of Home Economics, Lahore', 'Punjab'),
  ('institute-of-management-sciences-lahore', 'Institute of Management Sciences, Lahore', 'Punjab'),
  ('pakistan-institute-of-fashion-and-design', 'Pakistan Institute of Fashion and Design', 'Punjab'),
  ('institute-for-art-and-culture-lahore', 'Institute for Art and Culture, Lahore', 'Punjab'),
  ('punjab-tianjin-university-of-technology', 'Punjab Tianjin University of Technology', 'Punjab'),
  ('punjab-university-of-technology-rasul', 'Punjab University of Technology, Rasul', 'Punjab'),
  ('nur-international-university', 'NUR International University', 'Punjab'),
  ('green-international-university', 'Green International University', 'Punjab'),
  ('rashid-latif-khan-university', 'Rashid Latif Khan University', 'Punjab'),
  ('lahore-institute-of-science-and-technology', 'Lahore Institute of Science and Technology', 'Punjab'),
  ('pir-mehr-ali-shah-arid-agriculture-university-rawalpindi', 'Pir Mehr Ali Shah Arid Agriculture University, Rawalpindi', 'Punjab'),
  ('fatima-jinnah-women-university-rawalpindi', 'Fatima Jinnah Women University, Rawalpindi', 'Punjab'),
  ('rawalpindi-medical-university', 'Rawalpindi Medical University', 'Punjab'),
  ('national-university-of-medical-sciences', 'National University of Medical Sciences', 'Punjab'),
  ('rawalpindi-women-university', 'Rawalpindi Women University', 'Punjab'),
  ('government-viqar-un-nisa-women-university-rawalpindi', 'Government Viqar-un-Nisa Women University, Rawalpindi', 'Punjab'),
  ('university-of-engineering-and-technology-taxila', 'University of Engineering and Technology, Taxila', 'Punjab'),
  ('hitec-university-taxila', 'HITEC University, Taxila', 'Punjab'),
  ('university-of-wah', 'University of Wah', 'Punjab'),
  ('university-of-agriculture-faisalabad', 'University of Agriculture, Faisalabad', 'Punjab'),
  ('government-college-university-faisalabad', 'Government College University, Faisalabad', 'Punjab'),
  ('national-textile-university', 'National Textile University', 'Punjab'),
  ('faisalabad-medical-university', 'Faisalabad Medical University', 'Punjab'),
  ('university-of-faisalabad', 'University of Faisalabad', 'Punjab'),
  ('government-college-women-university-faisalabad', 'Government College Women University, Faisalabad', 'Punjab'),
  ('bahauddin-zakariya-university', 'Bahauddin Zakariya University', 'Punjab'),
  ('nishtar-medical-university', 'Nishtar Medical University', 'Punjab'),
  ('women-university-multan', 'Women University Multan', 'Punjab'),
  ('emerson-university-multan', 'Emerson University, Multan', 'Punjab'),
  ('muhammad-nawaz-sharif-university-of-agriculture-multan', 'Muhammad Nawaz Sharif University of Agriculture, Multan', 'Punjab'),
  ('muhammad-nawaz-sharif-university-of-engineering-and-technology-multan', 'Muhammad Nawaz Sharif University of Engineering and Technology, Multan', 'Punjab'),
  ('nfc-institute-of-engineering-and-technology-multan', 'NFC Institute of Engineering and Technology, Multan', 'Punjab'),
  ('institute-of-southern-punjab', 'Institute of Southern Punjab', 'Punjab'),
  ('multan-university-of-science-and-technology', 'Multan University of Science and Technology', 'Punjab'),
  ('times-institute-multan', 'Times Institute, Multan', 'Punjab'),
  ('the-islamia-university-of-bahawalpur', 'The Islamia University of Bahawalpur', 'Punjab'),
  ('government-sadiq-college-women-university-bahawalpur', 'Government Sadiq College Women University, Bahawalpur', 'Punjab'),
  ('cholistan-university-of-veterinary-and-animal-sciences', 'Cholistan University of Veterinary and Animal Sciences', 'Punjab'),
  ('khawaja-fareed-university-of-engineering-and-information-technology', 'Khawaja Fareed University of Engineering and Information Technology', 'Punjab'),
  ('university-of-sargodha', 'University of Sargodha', 'Punjab'),
  ('university-of-gujrat', 'University of Gujrat', 'Punjab'),
  ('the-university-of-chenab', 'The University of Chenab', 'Punjab'),
  ('gift-university', 'GIFT University', 'Punjab'),
  ('iisat-university-gujranwala', 'IISAT University, Gujranwala', 'Punjab'),
  ('international-institute-of-science-art-and-technology-gujranwala', 'International Institute of Science, Art and Technology, Gujranwala', 'Punjab'),
  ('university-of-sialkot', 'University of Sialkot', 'Punjab'),
  ('government-college-women-university-sialkot', 'Government College Women University, Sialkot', 'Punjab'),
  ('grand-asian-university-sialkot', 'Grand Asian University, Sialkot', 'Punjab'),
  ('ghazi-university-dera-ghazi-khan', 'Ghazi University, Dera Ghazi Khan', 'Punjab'),
  ('mir-chakar-khan-rind-university-of-technology-dera-ghazi-khan', 'Mir Chakar Khan Rind University of Technology, Dera Ghazi Khan', 'Punjab'),
  ('ghazi-national-institute-of-engineering-and-sciences', 'Ghazi National Institute of Engineering and Sciences', 'Punjab'),
  ('university-of-sahiwal', 'University of Sahiwal', 'Punjab'),
  ('university-of-okara', 'University of Okara', 'Punjab'),
  ('university-of-jhang', 'University of Jhang', 'Punjab'),
  ('university-of-narowal', 'University of Narowal', 'Punjab'),
  ('university-of-chakwal', 'University of Chakwal', 'Punjab'),
  ('university-of-mianwali', 'University of Mianwali', 'Punjab'),
  ('university-of-layyah', 'University of Layyah', 'Punjab'),
  ('thal-university-bhakkar', 'Thal University, Bhakkar', 'Punjab'),
  ('kohsar-university-murree', 'Kohsar University, Murree', 'Punjab'),
  ('namal-university-mianwali', 'Namal University, Mianwali', 'Punjab'),
  ('al-qadir-university-sohawa', 'Al-Qadir University, Sohawa', 'Punjab'),
  ('baba-guru-nanak-university-nankana-sahib', 'Baba Guru Nanak University, Nankana Sahib', 'Punjab'),
  ('institute-of-management-and-applied-sciences-khanewal', 'Institute of Management and Applied Sciences, Khanewal', 'Punjab'),
  ('university-of-karachi', 'University of Karachi', 'Sindh'),
  ('ned-university-of-engineering-and-technology', 'NED University of Engineering and Technology', 'Sindh'),
  ('institute-of-business-administration-karachi', 'Institute of Business Administration, Karachi', 'Sindh'),
  ('dow-university-of-health-sciences', 'Dow University of Health Sciences', 'Sindh'),
  ('aga-khan-university', 'Aga Khan University', 'Sindh'),
  ('habib-university', 'Habib University', 'Sindh'),
  ('hamdard-university', 'Hamdard University', 'Sindh'),
  ('ziauddin-university', 'Ziauddin University', 'Sindh'),
  ('iqra-university', 'Iqra University', 'Sindh'),
  ('shaheed-zulfiqar-ali-bhutto-institute-of-science-and-technology', 'Shaheed Zulfiqar Ali Bhutto Institute of Science and Technology', 'Sindh'),
  ('sir-syed-university-of-engineering-and-technology', 'Sir Syed University of Engineering and Technology', 'Sindh'),
  ('muhammad-ali-jinnah-university', 'Muhammad Ali Jinnah University', 'Sindh'),
  ('institute-of-business-management', 'Institute of Business Management', 'Sindh'),
  ('dawood-university-of-engineering-and-technology', 'Dawood University of Engineering and Technology', 'Sindh'),
  ('jinnah-sindh-medical-university', 'Jinnah Sindh Medical University', 'Sindh'),
  ('sindh-madressatul-islam-university', 'Sindh Madressatul Islam University', 'Sindh'),
  ('jinnah-university-for-women', 'Jinnah University for Women', 'Sindh'),
  ('dha-suffa-university', 'DHA Suffa University', 'Sindh'),
  ('baqai-medical-university', 'Baqai Medical University', 'Sindh'),
  ('indus-valley-school-of-art-and-architecture', 'Indus Valley School of Art and Architecture', 'Sindh'),
  ('textile-institute-of-pakistan', 'Textile Institute of Pakistan', 'Sindh'),
  ('karachi-institute-of-economics-and-technology', 'Karachi Institute of Economics and Technology', 'Sindh'),
  ('karachi-school-for-business-and-leadership', 'Karachi School for Business and Leadership', 'Sindh'),
  ('karachi-institute-of-technology-and-entrepreneurship', 'Karachi Institute of Technology and Entrepreneurship', 'Sindh'),
  ('karachi-institute-of-power-engineering', 'Karachi Institute of Power Engineering', 'Sindh'),
  ('greenwich-university-karachi', 'Greenwich University, Karachi', 'Sindh'),
  ('indus-university-karachi', 'Indus University, Karachi', 'Sindh'),
  ('ilma-university', 'Ilma University', 'Sindh'),
  ('preston-university-karachi', 'Preston University, Karachi', 'Sindh'),
  ('dadabhoy-institute-of-higher-education', 'Dadabhoy Institute of Higher Education', 'Sindh'),
  ('nazeer-hussain-university', 'Nazeer Hussain University', 'Sindh'),
  ('salim-habib-university', 'Salim Habib University', 'Sindh'),
  ('sohail-university', 'Sohail University', 'Sindh'),
  ('malir-university-of-science-and-technology', 'Malir University of Science and Technology', 'Sindh'),
  ('emaan-institute-of-management-and-sciences', 'Emaan Institute of Management and Sciences', 'Sindh'),
  ('millennium-institute-of-technology-and-entrepreneurship', 'Millennium Institute of Technology and Entrepreneurship', 'Sindh'),
  ('commecs-institute-of-business-and-emerging-sciences', 'Commecs Institute of Business and Emerging Sciences', 'Sindh'),
  ('kasb-institute-of-technology', 'KASB Institute of Technology', 'Sindh'),
  ('newports-institute-of-communications-and-economics', 'Newports Institute of Communications and Economics', 'Sindh'),
  ('sindh-institute-of-medical-sciences', 'Sindh Institute of Medical Sciences', 'Sindh'),
  ('city-university-of-health-sciences-karachi', 'City University of Health Sciences, Karachi', 'Sindh'),
  ('benazir-bhutto-shaheed-university-karachi', 'Benazir Bhutto Shaheed University, Karachi', 'Sindh'),
  ('shaheed-benazir-bhutto-city-university-karachi', 'Shaheed Benazir Bhutto City University, Karachi', 'Sindh'),
  ('shaheed-benazir-bhutto-dewan-university', 'Shaheed Benazir Bhutto Dewan University', 'Sindh'),
  ('shaheed-zulfiqar-ali-bhutto-university-of-law', 'Shaheed Zulfiqar Ali Bhutto University of Law', 'Sindh'),
  ('qalandar-shahbaz-university-of-modern-sciences', 'Qalandar Shahbaz University of Modern Sciences', 'Sindh'),
  ('university-of-sindh-jamshoro', 'University of Sindh, Jamshoro', 'Sindh'),
  ('mehran-university-of-engineering-and-technology', 'Mehran University of Engineering and Technology', 'Sindh'),
  ('liaquat-university-of-medical-and-health-sciences', 'Liaquat University of Medical and Health Sciences', 'Sindh'),
  ('sindh-agriculture-university-tandojam', 'Sindh Agriculture University, Tandojam', 'Sindh'),
  ('government-college-university-hyderabad', 'Government College University, Hyderabad', 'Sindh'),
  ('isra-university-hyderabad', 'Isra University, Hyderabad', 'Sindh'),
  ('university-of-east-hyderabad', 'University of EAST, Hyderabad', 'Sindh'),
  ('hyderabad-institute-for-technical-and-management-sciences', 'Hyderabad Institute for Technical and Management Sciences', 'Sindh'),
  ('university-of-art-and-culture-jamshoro', 'University of Art and Culture, Jamshoro', 'Sindh'),
  ('shaheed-allah-bux-soomro-university-of-art-design-and-heritages', 'Shaheed Allah Bux Soomro University of Art, Design and Heritages', 'Sindh'),
  ('shah-abdul-latif-university-khairpur', 'Shah Abdul Latif University, Khairpur', 'Sindh'),
  ('sukkur-iba-university', 'Sukkur IBA University', 'Sindh'),
  ('quaid-e-awam-university-of-engineering-science-and-technology', 'Quaid-e-Awam University of Engineering, Science and Technology', 'Sindh'),
  ('shaheed-benazir-bhutto-university-benazirabad', 'Shaheed Benazir Bhutto University, Benazirabad', 'Sindh'),
  ('peoples-university-of-medical-and-health-sciences-for-women', 'Peoples University of Medical and Health Sciences for Women', 'Sindh'),
  ('shaheed-benazir-bhutto-university-of-veterinary-and-animal-sciences', 'Shaheed Benazir Bhutto University of Veterinary and Animal Sciences', 'Sindh'),
  ('shaheed-mohtarma-benazir-bhutto-medical-university-larkana', 'Shaheed Mohtarma Benazir Bhutto Medical University, Larkana', 'Sindh'),
  ('university-of-larkano', 'University of Larkano', 'Sindh'),
  ('begum-nusrat-bhutto-women-university-sukkur', 'Begum Nusrat Bhutto Women University, Sukkur', 'Sindh'),
  ('aror-university-of-art-architecture-design-and-heritage', 'Aror University of Art, Architecture, Design and Heritage', 'Sindh'),
  ('the-shaikh-ayaz-university-shikarpur', 'The Shaikh Ayaz University, Shikarpur', 'Sindh'),
  ('pir-abdul-qadir-shah-jeelani-institute-of-medical-sciences', 'Pir Abdul Qadir Shah Jeelani Institute of Medical Sciences', 'Sindh'),
  ('benazir-bhutto-shaheed-university-of-technology-and-skill-development', 'Benazir Bhutto Shaheed University of Technology and Skill Development', 'Sindh'),
  ('university-of-sufism-and-modern-sciences-bhit-shah', 'University of Sufism and Modern Sciences, Bhit Shah', 'Sindh'),
  ('university-of-peshawar', 'University of Peshawar', 'Khyber Pakhtunkhwa'),
  ('university-of-engineering-and-technology-peshawar', 'University of Engineering and Technology, Peshawar', 'Khyber Pakhtunkhwa'),
  ('islamia-college-university-peshawar', 'Islamia College University, Peshawar', 'Khyber Pakhtunkhwa'),
  ('khyber-medical-university', 'Khyber Medical University', 'Khyber Pakhtunkhwa'),
  ('university-of-agriculture-peshawar', 'University of Agriculture, Peshawar', 'Khyber Pakhtunkhwa'),
  ('institute-of-management-sciences-peshawar', 'Institute of Management Sciences, Peshawar', 'Khyber Pakhtunkhwa'),
  ('ghulam-ishaq-khan-institute-of-engineering-sciences-and-technology', 'Ghulam Ishaq Khan Institute of Engineering Sciences and Technology', 'Khyber Pakhtunkhwa'),
  ('abdul-wali-khan-university-mardan', 'Abdul Wali Khan University, Mardan', 'Khyber Pakhtunkhwa'),
  ('hazara-university-mansehra', 'Hazara University, Mansehra', 'Khyber Pakhtunkhwa'),
  ('kohat-university-of-science-and-technology', 'Kohat University of Science and Technology', 'Khyber Pakhtunkhwa'),
  ('gomal-university-dera-ismail-khan', 'Gomal University, Dera Ismail Khan', 'Khyber Pakhtunkhwa'),
  ('university-of-malakand', 'University of Malakand', 'Khyber Pakhtunkhwa'),
  ('university-of-swat', 'University of Swat', 'Khyber Pakhtunkhwa'),
  ('university-of-haripur', 'University of Haripur', 'Khyber Pakhtunkhwa'),
  ('university-of-swabi', 'University of Swabi', 'Khyber Pakhtunkhwa'),
  ('university-of-buner', 'University of Buner', 'Khyber Pakhtunkhwa'),
  ('university-of-chitral', 'University of Chitral', 'Khyber Pakhtunkhwa'),
  ('university-of-dir-timergara', 'University of Dir, Timergara', 'Khyber Pakhtunkhwa'),
  ('university-of-shangla', 'University of Shangla', 'Khyber Pakhtunkhwa'),
  ('university-of-lakki-marwat', 'University of Lakki Marwat', 'Khyber Pakhtunkhwa'),
  ('university-of-science-and-technology-bannu', 'University of Science and Technology, Bannu', 'Khyber Pakhtunkhwa'),
  ('bacha-khan-university-charsadda', 'Bacha Khan University, Charsadda', 'Khyber Pakhtunkhwa'),
  ('khushal-khan-khattak-university-karak', 'Khushal Khan Khattak University, Karak', 'Khyber Pakhtunkhwa'),
  ('abbottabad-university-of-science-and-technology', 'Abbottabad University of Science and Technology', 'Khyber Pakhtunkhwa'),
  ('shaheed-benazir-bhutto-university-sheringal', 'Shaheed Benazir Bhutto University, Sheringal', 'Khyber Pakhtunkhwa'),
  ('shaheed-benazir-bhutto-women-university-peshawar', 'Shaheed Benazir Bhutto Women University, Peshawar', 'Khyber Pakhtunkhwa'),
  ('women-university-mardan', 'Women University, Mardan', 'Khyber Pakhtunkhwa'),
  ('women-university-swabi', 'Women University, Swabi', 'Khyber Pakhtunkhwa'),
  ('fata-university', 'FATA University', 'Khyber Pakhtunkhwa'),
  ('university-of-engineering-and-technology-mardan', 'University of Engineering and Technology, Mardan', 'Khyber Pakhtunkhwa'),
  ('university-of-agriculture-dera-ismail-khan', 'University of Agriculture, Dera Ismail Khan', 'Khyber Pakhtunkhwa'),
  ('university-of-technology-nowshera', 'University of Technology, Nowshera', 'Khyber Pakhtunkhwa'),
  ('university-of-engineering-and-applied-sciences-swat', 'University of Engineering and Applied Sciences, Swat', 'Khyber Pakhtunkhwa'),
  ('university-of-veterinary-and-animal-sciences-swat', 'University of Veterinary and Animal Sciences, Swat', 'Khyber Pakhtunkhwa'),
  ('pak-austria-fachhochschule-institute-of-applied-sciences-and-technology', 'Pak-Austria Fachhochschule: Institute of Applied Sciences and Technology', 'Khyber Pakhtunkhwa'),
  ('cecos-university-of-information-technology-and-emerging-sciences', 'CECOS University of Information Technology and Emerging Sciences', 'Khyber Pakhtunkhwa'),
  ('city-university-of-science-and-information-technology-peshawar', 'City University of Science and Information Technology, Peshawar', 'Khyber Pakhtunkhwa'),
  ('sarhad-university-of-science-and-information-technology', 'Sarhad University of Science and Information Technology', 'Khyber Pakhtunkhwa'),
  ('iqra-national-university-peshawar', 'IQRA National University, Peshawar', 'Khyber Pakhtunkhwa'),
  ('abasyn-university-peshawar', 'Abasyn University, Peshawar', 'Khyber Pakhtunkhwa'),
  ('gandhara-university-peshawar', 'Gandhara University, Peshawar', 'Khyber Pakhtunkhwa'),
  ('qurtuba-university-of-science-and-information-technology', 'Qurtuba University of Science and Information Technology', 'Khyber Pakhtunkhwa'),
  ('northern-university-nowshera', 'Northern University, Nowshera', 'Khyber Pakhtunkhwa'),
  ('preston-university-kohat', 'Preston University, Kohat', 'Khyber Pakhtunkhwa'),
  ('university-of-balochistan', 'University of Balochistan', 'Balochistan'),
  ('balochistan-university-of-information-technology-engineering-and-management-sciences', 'Balochistan University of Information Technology, Engineering and Management Sciences', 'Balochistan'),
  ('balochistan-university-of-engineering-and-technology-khuzdar', 'Balochistan University of Engineering and Technology, Khuzdar', 'Balochistan'),
  ('bolan-university-of-medical-and-health-sciences', 'Bolan University of Medical and Health Sciences', 'Balochistan'),
  ('sardar-bahadur-khan-womens-university', 'Sardar Bahadur Khan Women’s University', 'Balochistan'),
  ('lasbela-university-of-agriculture-water-and-marine-sciences', 'Lasbela University of Agriculture, Water and Marine Sciences', 'Balochistan'),
  ('university-of-turbat', 'University of Turbat', 'Balochistan'),
  ('university-of-loralai', 'University of Loralai', 'Balochistan'),
  ('university-of-gwadar', 'University of Gwadar', 'Balochistan'),
  ('university-of-makran-panjgur', 'University of Makran, Panjgur', 'Balochistan'),
  ('mir-chakar-khan-rind-university-sibi', 'Mir Chakar Khan Rind University, Sibi', 'Balochistan'),
  ('al-hamd-islamic-university', 'Al-Hamd Islamic University', 'Balochistan'),
  ('pakistan-military-academy-kakul', 'Pakistan Military Academy, Kakul', 'Federal'),
  ('pakistan-air-force-academy-risalpur', 'Pakistan Air Force Academy, Risalpur', 'Federal'),
  ('pakistan-naval-academy-karachi', 'Pakistan Naval Academy, Karachi', 'Federal')
on conflict (id) do nothing;

insert into tnr_university_aliases (alias_norm, university_id) values
  ('karakoram international university', 'karakoram-international-university'),
  ('kiu', 'karakoram-international-university'),
  ('baltistan university skardu', 'baltistan-university-skardu'),
  ('baltistan university', 'baltistan-university-skardu'),
  ('uobs', 'baltistan-university-skardu'),
  ('university of baltistan', 'baltistan-university-skardu'),
  ('university of baltistan skardu', 'baltistan-university-skardu'),
  ('university of azad jammu and kashmir', 'university-of-azad-jammu-and-kashmir'),
  ('ajku', 'university-of-azad-jammu-and-kashmir'),
  ('mirpur university of science and technology', 'mirpur-university-of-science-and-technology'),
  ('university of poonch rawalakot', 'university-of-poonch-rawalakot'),
  ('university of poonch', 'university-of-poonch-rawalakot'),
  ('university of kotli', 'university-of-kotli'),
  ('women university of azad jammu and kashmir bagh', 'women-university-of-azad-jammu-and-kashmir-bagh'),
  ('women university of azad jammu and kashmir', 'women-university-of-azad-jammu-and-kashmir-bagh'),
  ('al khair university', 'al-khair-university'),
  ('mohi ud din islamic university', 'mohi-ud-din-islamic-university'),
  ('quaid i azam university', 'quaid-i-azam-university'),
  ('qau', 'quaid-i-azam-university'),
  ('quaid e azam university', 'quaid-i-azam-university'),
  ('national university of sciences and technology', 'national-university-of-sciences-and-technology'),
  ('nust', 'national-university-of-sciences-and-technology'),
  ('comsats university islamabad', 'comsats-university-islamabad'),
  ('cui', 'comsats-university-islamabad'),
  ('comsats', 'comsats-university-islamabad'),
  ('comsats university', 'comsats-university-islamabad'),
  ('ciit', 'comsats-university-islamabad'),
  ('comsats institute of information technology', 'comsats-university-islamabad'),
  ('international islamic university islamabad', 'international-islamic-university-islamabad'),
  ('international islamic university', 'international-islamic-university-islamabad'),
  ('iiui', 'international-islamic-university-islamabad'),
  ('allama iqbal open university', 'allama-iqbal-open-university'),
  ('aiou', 'allama-iqbal-open-university'),
  ('national university of modern languages', 'national-university-of-modern-languages'),
  ('numl', 'national-university-of-modern-languages'),
  ('virtual university of pakistan', 'virtual-university-of-pakistan'),
  ('pakistan institute of engineering and applied sciences', 'pakistan-institute-of-engineering-and-applied-sciences'),
  ('pieas', 'pakistan-institute-of-engineering-and-applied-sciences'),
  ('national university of computer and emerging sciences', 'national-university-of-computer-and-emerging-sciences'),
  ('fast', 'national-university-of-computer-and-emerging-sciences'),
  ('nuces', 'national-university-of-computer-and-emerging-sciences'),
  ('fast nuces', 'national-university-of-computer-and-emerging-sciences'),
  ('air university islamabad', 'air-university-islamabad'),
  ('air university', 'air-university-islamabad'),
  ('bahria university', 'bahria-university'),
  ('riphah international university', 'riphah-international-university'),
  ('capital university of science and technology', 'capital-university-of-science-and-technology'),
  ('cust', 'capital-university-of-science-and-technology'),
  ('institute of space technology', 'institute-of-space-technology'),
  ('foundation university islamabad', 'foundation-university-islamabad'),
  ('federal urdu university of arts science and technology', 'federal-urdu-university-of-arts-science-and-technology'),
  ('federal urdu university of arts', 'federal-urdu-university-of-arts-science-and-technology'),
  ('fuuast', 'federal-urdu-university-of-arts-science-and-technology'),
  ('national defence university islamabad', 'national-defence-university-islamabad'),
  ('national defence university', 'national-defence-university-islamabad'),
  ('national university of technology', 'national-university-of-technology'),
  ('nutech', 'national-university-of-technology'),
  ('national skills university islamabad', 'national-skills-university-islamabad'),
  ('national skills university', 'national-skills-university-islamabad'),
  ('pakistan institute of development economics', 'pakistan-institute-of-development-economics'),
  ('pide', 'pakistan-institute-of-development-economics'),
  ('shaheed zulfiqar ali bhutto medical university', 'shaheed-zulfiqar-ali-bhutto-medical-university'),
  ('szabmu', 'shaheed-zulfiqar-ali-bhutto-medical-university'),
  ('shifa tameer e millat university', 'shifa-tameer-e-millat-university'),
  ('sir syed case institute of technology', 'sir-syed-case-institute-of-technology'),
  ('case', 'sir-syed-case-institute-of-technology'),
  ('muslim youth university', 'muslim-youth-university'),
  ('ibadat international university', 'ibadat-international-university'),
  ('university of the punjab', 'university-of-the-punjab'),
  ('punjab university', 'university-of-the-punjab'),
  ('university of punjab', 'university-of-the-punjab'),
  ('university of engineering and technology lahore', 'university-of-engineering-and-technology-lahore'),
  ('uet lahore', 'university-of-engineering-and-technology-lahore'),
  ('government college university lahore', 'government-college-university-lahore'),
  ('gcu lahore', 'government-college-university-lahore'),
  ('lahore university of management sciences', 'lahore-university-of-management-sciences'),
  ('lums', 'lahore-university-of-management-sciences'),
  ('king edward medical university', 'king-edward-medical-university'),
  ('kemu', 'king-edward-medical-university'),
  ('university of health sciences lahore', 'university-of-health-sciences-lahore'),
  ('university of health sciences', 'university-of-health-sciences-lahore'),
  ('uhs', 'university-of-health-sciences-lahore'),
  ('university of veterinary and animal sciences lahore', 'university-of-veterinary-and-animal-sciences-lahore'),
  ('uvas', 'university-of-veterinary-and-animal-sciences-lahore'),
  ('university of education lahore', 'university-of-education-lahore'),
  ('university of education', 'university-of-education-lahore'),
  ('university of management and technology lahore', 'university-of-management-and-technology-lahore'),
  ('university of management and technology', 'university-of-management-and-technology-lahore'),
  ('umt', 'university-of-management-and-technology-lahore'),
  ('university of central punjab', 'university-of-central-punjab'),
  ('ucp', 'university-of-central-punjab'),
  ('university of lahore', 'university-of-lahore'),
  ('information technology university of the punjab', 'information-technology-university-of-the-punjab'),
  ('itu', 'information-technology-university-of-the-punjab'),
  ('forman christian college university', 'forman-christian-college-university'),
  ('fccu', 'forman-christian-college-university'),
  ('kinnaird college for women university', 'kinnaird-college-for-women-university'),
  ('lahore college for women university', 'lahore-college-for-women-university'),
  ('lcwu', 'lahore-college-for-women-university'),
  ('fatima jinnah medical university', 'fatima-jinnah-medical-university'),
  ('fjmu', 'fatima-jinnah-medical-university'),
  ('national college of arts', 'national-college-of-arts'),
  ('national college of business administration and economics', 'national-college-of-business-administration-and-economics'),
  ('ncbae', 'national-college-of-business-administration-and-economics'),
  ('beaconhouse national university', 'beaconhouse-national-university'),
  ('minhaj university lahore', 'minhaj-university-lahore'),
  ('minhaj university', 'minhaj-university-lahore'),
  ('hajvery university', 'hajvery-university'),
  ('qarshi university', 'qarshi-university'),
  ('superior university lahore', 'superior-university-lahore'),
  ('superior university', 'superior-university-lahore'),
  ('university of south asia', 'university-of-south-asia'),
  ('lahore garrison university', 'lahore-garrison-university'),
  ('lahore school of economics', 'lahore-school-of-economics'),
  ('university of home economics lahore', 'university-of-home-economics-lahore'),
  ('university of home economics', 'university-of-home-economics-lahore'),
  ('institute of management sciences lahore', 'institute-of-management-sciences-lahore'),
  ('pak aims', 'institute-of-management-sciences-lahore'),
  ('pakistan institute of fashion and design', 'pakistan-institute-of-fashion-and-design'),
  ('pifd', 'pakistan-institute-of-fashion-and-design'),
  ('institute for art and culture lahore', 'institute-for-art-and-culture-lahore'),
  ('institute for art and culture', 'institute-for-art-and-culture-lahore'),
  ('punjab tianjin university of technology', 'punjab-tianjin-university-of-technology'),
  ('ptut', 'punjab-tianjin-university-of-technology'),
  ('punjab university of technology rasul', 'punjab-university-of-technology-rasul'),
  ('punjab university of technology', 'punjab-university-of-technology-rasul'),
  ('nur international university', 'nur-international-university'),
  ('green international university', 'green-international-university'),
  ('rashid latif khan university', 'rashid-latif-khan-university'),
  ('lahore institute of science and technology', 'lahore-institute-of-science-and-technology'),
  ('pir mehr ali shah arid agriculture university rawalpindi', 'pir-mehr-ali-shah-arid-agriculture-university-rawalpindi'),
  ('pir mehr ali shah arid agriculture university', 'pir-mehr-ali-shah-arid-agriculture-university-rawalpindi'),
  ('pmas aaur', 'pir-mehr-ali-shah-arid-agriculture-university-rawalpindi'),
  ('uaar', 'pir-mehr-ali-shah-arid-agriculture-university-rawalpindi'),
  ('arid agriculture university', 'pir-mehr-ali-shah-arid-agriculture-university-rawalpindi'),
  ('fatima jinnah women university rawalpindi', 'fatima-jinnah-women-university-rawalpindi'),
  ('fatima jinnah women university', 'fatima-jinnah-women-university-rawalpindi'),
  ('fjwu', 'fatima-jinnah-women-university-rawalpindi'),
  ('rawalpindi medical university', 'rawalpindi-medical-university'),
  ('national university of medical sciences', 'national-university-of-medical-sciences'),
  ('nums', 'national-university-of-medical-sciences'),
  ('rawalpindi women university', 'rawalpindi-women-university'),
  ('government viqar un nisa women university rawalpindi', 'government-viqar-un-nisa-women-university-rawalpindi'),
  ('government viqar un nisa women university', 'government-viqar-un-nisa-women-university-rawalpindi'),
  ('university of engineering and technology taxila', 'university-of-engineering-and-technology-taxila'),
  ('uet taxila', 'university-of-engineering-and-technology-taxila'),
  ('hitec university taxila', 'hitec-university-taxila'),
  ('hitec university', 'hitec-university-taxila'),
  ('university of wah', 'university-of-wah'),
  ('university of agriculture faisalabad', 'university-of-agriculture-faisalabad'),
  ('uaf', 'university-of-agriculture-faisalabad'),
  ('government college university faisalabad', 'government-college-university-faisalabad'),
  ('gcuf', 'government-college-university-faisalabad'),
  ('national textile university', 'national-textile-university'),
  ('faisalabad medical university', 'faisalabad-medical-university'),
  ('university of faisalabad', 'university-of-faisalabad'),
  ('government college women university faisalabad', 'government-college-women-university-faisalabad'),
  ('gcwuf', 'government-college-women-university-faisalabad'),
  ('bahauddin zakariya university', 'bahauddin-zakariya-university'),
  ('bzu', 'bahauddin-zakariya-university'),
  ('nishtar medical university', 'nishtar-medical-university'),
  ('women university multan', 'women-university-multan'),
  ('emerson university multan', 'emerson-university-multan'),
  ('emerson university', 'emerson-university-multan'),
  ('muhammad nawaz sharif university of agriculture multan', 'muhammad-nawaz-sharif-university-of-agriculture-multan'),
  ('muhammad nawaz sharif university of agriculture', 'muhammad-nawaz-sharif-university-of-agriculture-multan'),
  ('mnsuam', 'muhammad-nawaz-sharif-university-of-agriculture-multan'),
  ('muhammad nawaz sharif university of engineering and technology multan', 'muhammad-nawaz-sharif-university-of-engineering-and-technology-multan'),
  ('muhammad nawaz sharif university of engineering and technology', 'muhammad-nawaz-sharif-university-of-engineering-and-technology-multan'),
  ('mnsuet', 'muhammad-nawaz-sharif-university-of-engineering-and-technology-multan'),
  ('nfc institute of engineering and technology multan', 'nfc-institute-of-engineering-and-technology-multan'),
  ('nfc institute of engineering and technology', 'nfc-institute-of-engineering-and-technology-multan'),
  ('nfciet', 'nfc-institute-of-engineering-and-technology-multan'),
  ('institute of southern punjab', 'institute-of-southern-punjab'),
  ('multan university of science and technology', 'multan-university-of-science-and-technology'),
  ('must multan', 'multan-university-of-science-and-technology'),
  ('times institute multan', 'times-institute-multan'),
  ('times institute', 'times-institute-multan'),
  ('islamia university of bahawalpur', 'the-islamia-university-of-bahawalpur'),
  ('iub', 'the-islamia-university-of-bahawalpur'),
  ('government sadiq college women university bahawalpur', 'government-sadiq-college-women-university-bahawalpur'),
  ('government sadiq college women university', 'government-sadiq-college-women-university-bahawalpur'),
  ('gscwu', 'government-sadiq-college-women-university-bahawalpur'),
  ('cholistan university of veterinary and animal sciences', 'cholistan-university-of-veterinary-and-animal-sciences'),
  ('cuvas', 'cholistan-university-of-veterinary-and-animal-sciences'),
  ('khawaja fareed university of engineering and information technology', 'khawaja-fareed-university-of-engineering-and-information-technology'),
  ('kfueit', 'khawaja-fareed-university-of-engineering-and-information-technology'),
  ('university of sargodha', 'university-of-sargodha'),
  ('university of gujrat', 'university-of-gujrat'),
  ('university of chenab', 'the-university-of-chenab'),
  ('gift university', 'gift-university'),
  ('iisat university gujranwala', 'iisat-university-gujranwala'),
  ('iisat university', 'iisat-university-gujranwala'),
  ('international institute of science art and technology gujranwala', 'international-institute-of-science-art-and-technology-gujranwala'),
  ('international institute of science art and technology', 'international-institute-of-science-art-and-technology-gujranwala'),
  ('university of sialkot', 'university-of-sialkot'),
  ('uskt', 'university-of-sialkot'),
  ('government college women university sialkot', 'government-college-women-university-sialkot'),
  ('gcwus', 'government-college-women-university-sialkot'),
  ('grand asian university sialkot', 'grand-asian-university-sialkot'),
  ('grand asian university', 'grand-asian-university-sialkot'),
  ('ghazi university dera ghazi khan', 'ghazi-university-dera-ghazi-khan'),
  ('ghazi university', 'ghazi-university-dera-ghazi-khan'),
  ('mir chakar khan rind university of technology dera ghazi khan', 'mir-chakar-khan-rind-university-of-technology-dera-ghazi-khan'),
  ('mir chakar khan rind university of technology', 'mir-chakar-khan-rind-university-of-technology-dera-ghazi-khan'),
  ('ghazi national institute of engineering and sciences', 'ghazi-national-institute-of-engineering-and-sciences'),
  ('university of sahiwal', 'university-of-sahiwal'),
  ('university of okara', 'university-of-okara'),
  ('university of jhang', 'university-of-jhang'),
  ('university of narowal', 'university-of-narowal'),
  ('university of chakwal', 'university-of-chakwal'),
  ('university of mianwali', 'university-of-mianwali'),
  ('university of layyah', 'university-of-layyah'),
  ('thal university bhakkar', 'thal-university-bhakkar'),
  ('thal university', 'thal-university-bhakkar'),
  ('kohsar university murree', 'kohsar-university-murree'),
  ('kohsar university', 'kohsar-university-murree'),
  ('namal university mianwali', 'namal-university-mianwali'),
  ('namal university', 'namal-university-mianwali'),
  ('al qadir university sohawa', 'al-qadir-university-sohawa'),
  ('al qadir university', 'al-qadir-university-sohawa'),
  ('baba guru nanak university nankana sahib', 'baba-guru-nanak-university-nankana-sahib'),
  ('baba guru nanak university', 'baba-guru-nanak-university-nankana-sahib'),
  ('institute of management and applied sciences khanewal', 'institute-of-management-and-applied-sciences-khanewal'),
  ('institute of management and applied sciences', 'institute-of-management-and-applied-sciences-khanewal'),
  ('university of karachi', 'university-of-karachi'),
  ('karachi university', 'university-of-karachi'),
  ('ned university of engineering and technology', 'ned-university-of-engineering-and-technology'),
  ('ned', 'ned-university-of-engineering-and-technology'),
  ('institute of business administration karachi', 'institute-of-business-administration-karachi'),
  ('institute of business administration', 'institute-of-business-administration-karachi'),
  ('iba karachi', 'institute-of-business-administration-karachi'),
  ('dow university of health sciences', 'dow-university-of-health-sciences'),
  ('duhs', 'dow-university-of-health-sciences'),
  ('aga khan university', 'aga-khan-university'),
  ('aku', 'aga-khan-university'),
  ('habib university', 'habib-university'),
  ('hamdard university', 'hamdard-university'),
  ('ziauddin university', 'ziauddin-university'),
  ('iqra university', 'iqra-university'),
  ('shaheed zulfiqar ali bhutto institute of science and technology', 'shaheed-zulfiqar-ali-bhutto-institute-of-science-and-technology'),
  ('szabist', 'shaheed-zulfiqar-ali-bhutto-institute-of-science-and-technology'),
  ('sir syed university of engineering and technology', 'sir-syed-university-of-engineering-and-technology'),
  ('ssuet', 'sir-syed-university-of-engineering-and-technology'),
  ('muhammad ali jinnah university', 'muhammad-ali-jinnah-university'),
  ('maju', 'muhammad-ali-jinnah-university'),
  ('institute of business management', 'institute-of-business-management'),
  ('iobm', 'institute-of-business-management'),
  ('dawood university of engineering and technology', 'dawood-university-of-engineering-and-technology'),
  ('duet', 'dawood-university-of-engineering-and-technology'),
  ('jinnah sindh medical university', 'jinnah-sindh-medical-university'),
  ('jsmu', 'jinnah-sindh-medical-university'),
  ('sindh madressatul islam university', 'sindh-madressatul-islam-university'),
  ('smiu', 'sindh-madressatul-islam-university'),
  ('jinnah university for women', 'jinnah-university-for-women'),
  ('juw', 'jinnah-university-for-women'),
  ('dha suffa university', 'dha-suffa-university'),
  ('baqai medical university', 'baqai-medical-university'),
  ('indus valley school of art and architecture', 'indus-valley-school-of-art-and-architecture'),
  ('textile institute of pakistan', 'textile-institute-of-pakistan'),
  ('karachi institute of economics and technology', 'karachi-institute-of-economics-and-technology'),
  ('kiet', 'karachi-institute-of-economics-and-technology'),
  ('karachi school for business and leadership', 'karachi-school-for-business-and-leadership'),
  ('ksbl', 'karachi-school-for-business-and-leadership'),
  ('karachi institute of technology and entrepreneurship', 'karachi-institute-of-technology-and-entrepreneurship'),
  ('karachi institute of power engineering', 'karachi-institute-of-power-engineering'),
  ('kinpoe', 'karachi-institute-of-power-engineering'),
  ('greenwich university karachi', 'greenwich-university-karachi'),
  ('greenwich university', 'greenwich-university-karachi'),
  ('indus university karachi', 'indus-university-karachi'),
  ('indus university', 'indus-university-karachi'),
  ('ilma university', 'ilma-university'),
  ('preston university karachi', 'preston-university-karachi'),
  ('dadabhoy institute of higher education', 'dadabhoy-institute-of-higher-education'),
  ('nazeer hussain university', 'nazeer-hussain-university'),
  ('salim habib university', 'salim-habib-university'),
  ('sohail university', 'sohail-university'),
  ('malir university of science and technology', 'malir-university-of-science-and-technology'),
  ('emaan institute of management and sciences', 'emaan-institute-of-management-and-sciences'),
  ('millennium institute of technology and entrepreneurship', 'millennium-institute-of-technology-and-entrepreneurship'),
  ('commecs institute of business and emerging sciences', 'commecs-institute-of-business-and-emerging-sciences'),
  ('kasb institute of technology', 'kasb-institute-of-technology'),
  ('newports institute of communications and economics', 'newports-institute-of-communications-and-economics'),
  ('sindh institute of medical sciences', 'sindh-institute-of-medical-sciences'),
  ('city university of health sciences karachi', 'city-university-of-health-sciences-karachi'),
  ('city university of health sciences', 'city-university-of-health-sciences-karachi'),
  ('benazir bhutto shaheed university karachi', 'benazir-bhutto-shaheed-university-karachi'),
  ('benazir bhutto shaheed university', 'benazir-bhutto-shaheed-university-karachi'),
  ('shaheed benazir bhutto city university karachi', 'shaheed-benazir-bhutto-city-university-karachi'),
  ('shaheed benazir bhutto city university', 'shaheed-benazir-bhutto-city-university-karachi'),
  ('shaheed benazir bhutto dewan university', 'shaheed-benazir-bhutto-dewan-university'),
  ('shaheed zulfiqar ali bhutto university of law', 'shaheed-zulfiqar-ali-bhutto-university-of-law'),
  ('szabul', 'shaheed-zulfiqar-ali-bhutto-university-of-law'),
  ('qalandar shahbaz university of modern sciences', 'qalandar-shahbaz-university-of-modern-sciences'),
  ('university of sindh jamshoro', 'university-of-sindh-jamshoro'),
  ('university of sindh', 'university-of-sindh-jamshoro'),
  ('usindh', 'university-of-sindh-jamshoro'),
  ('mehran university of engineering and technology', 'mehran-university-of-engineering-and-technology'),
  ('muet', 'mehran-university-of-engineering-and-technology'),
  ('liaquat university of medical and health sciences', 'liaquat-university-of-medical-and-health-sciences'),
  ('lumhs', 'liaquat-university-of-medical-and-health-sciences'),
  ('sindh agriculture university tandojam', 'sindh-agriculture-university-tandojam'),
  ('sindh agriculture university', 'sindh-agriculture-university-tandojam'),
  ('government college university hyderabad', 'government-college-university-hyderabad'),
  ('isra university hyderabad', 'isra-university-hyderabad'),
  ('isra university', 'isra-university-hyderabad'),
  ('university of east hyderabad', 'university-of-east-hyderabad'),
  ('university of east', 'university-of-east-hyderabad'),
  ('hyderabad institute for technical and management sciences', 'hyderabad-institute-for-technical-and-management-sciences'),
  ('university of art and culture jamshoro', 'university-of-art-and-culture-jamshoro'),
  ('university of art and culture', 'university-of-art-and-culture-jamshoro'),
  ('shaheed allah bux soomro university of art design and heritages', 'shaheed-allah-bux-soomro-university-of-art-design-and-heritages'),
  ('shaheed allah bux soomro university of art', 'shaheed-allah-bux-soomro-university-of-art-design-and-heritages'),
  ('shah abdul latif university khairpur', 'shah-abdul-latif-university-khairpur'),
  ('shah abdul latif university', 'shah-abdul-latif-university-khairpur'),
  ('salu', 'shah-abdul-latif-university-khairpur'),
  ('sukkur iba university', 'sukkur-iba-university'),
  ('iba sukkur', 'sukkur-iba-university'),
  ('quaid e awam university of engineering science and technology', 'quaid-e-awam-university-of-engineering-science-and-technology'),
  ('quaid e awam university of engineering', 'quaid-e-awam-university-of-engineering-science-and-technology'),
  ('quest', 'quaid-e-awam-university-of-engineering-science-and-technology'),
  ('shaheed benazir bhutto university benazirabad', 'shaheed-benazir-bhutto-university-benazirabad'),
  ('peoples university of medical and health sciences for women', 'peoples-university-of-medical-and-health-sciences-for-women'),
  ('pumhs', 'peoples-university-of-medical-and-health-sciences-for-women'),
  ('shaheed benazir bhutto university of veterinary and animal sciences', 'shaheed-benazir-bhutto-university-of-veterinary-and-animal-sciences'),
  ('sbbuvas', 'shaheed-benazir-bhutto-university-of-veterinary-and-animal-sciences'),
  ('shaheed mohtarma benazir bhutto medical university larkana', 'shaheed-mohtarma-benazir-bhutto-medical-university-larkana'),
  ('shaheed mohtarma benazir bhutto medical university', 'shaheed-mohtarma-benazir-bhutto-medical-university-larkana'),
  ('smbbmu', 'shaheed-mohtarma-benazir-bhutto-medical-university-larkana'),
  ('university of larkano', 'university-of-larkano'),
  ('begum nusrat bhutto women university sukkur', 'begum-nusrat-bhutto-women-university-sukkur'),
  ('begum nusrat bhutto women university', 'begum-nusrat-bhutto-women-university-sukkur'),
  ('aror university of art architecture design and heritage', 'aror-university-of-art-architecture-design-and-heritage'),
  ('aror university of art architecture', 'aror-university-of-art-architecture-design-and-heritage'),
  ('shaikh ayaz university shikarpur', 'the-shaikh-ayaz-university-shikarpur'),
  ('shaikh ayaz university', 'the-shaikh-ayaz-university-shikarpur'),
  ('pir abdul qadir shah jeelani institute of medical sciences', 'pir-abdul-qadir-shah-jeelani-institute-of-medical-sciences'),
  ('benazir bhutto shaheed university of technology and skill development', 'benazir-bhutto-shaheed-university-of-technology-and-skill-development'),
  ('university of sufism and modern sciences bhit shah', 'university-of-sufism-and-modern-sciences-bhit-shah'),
  ('university of sufism and modern sciences', 'university-of-sufism-and-modern-sciences-bhit-shah'),
  ('university of peshawar', 'university-of-peshawar'),
  ('peshawar university', 'university-of-peshawar'),
  ('university of engineering and technology peshawar', 'university-of-engineering-and-technology-peshawar'),
  ('uet peshawar', 'university-of-engineering-and-technology-peshawar'),
  ('islamia college university peshawar', 'islamia-college-university-peshawar'),
  ('islamia college university', 'islamia-college-university-peshawar'),
  ('khyber medical university', 'khyber-medical-university'),
  ('kmu', 'khyber-medical-university'),
  ('university of agriculture peshawar', 'university-of-agriculture-peshawar'),
  ('institute of management sciences peshawar', 'institute-of-management-sciences-peshawar'),
  ('imsciences', 'institute-of-management-sciences-peshawar'),
  ('ghulam ishaq khan institute of engineering sciences and technology', 'ghulam-ishaq-khan-institute-of-engineering-sciences-and-technology'),
  ('giki', 'ghulam-ishaq-khan-institute-of-engineering-sciences-and-technology'),
  ('abdul wali khan university mardan', 'abdul-wali-khan-university-mardan'),
  ('abdul wali khan university', 'abdul-wali-khan-university-mardan'),
  ('awkum', 'abdul-wali-khan-university-mardan'),
  ('hazara university mansehra', 'hazara-university-mansehra'),
  ('hazara university', 'hazara-university-mansehra'),
  ('kohat university of science and technology', 'kohat-university-of-science-and-technology'),
  ('kust', 'kohat-university-of-science-and-technology'),
  ('gomal university dera ismail khan', 'gomal-university-dera-ismail-khan'),
  ('gomal university', 'gomal-university-dera-ismail-khan'),
  ('university of malakand', 'university-of-malakand'),
  ('university of swat', 'university-of-swat'),
  ('university of haripur', 'university-of-haripur'),
  ('university of swabi', 'university-of-swabi'),
  ('university of buner', 'university-of-buner'),
  ('university of chitral', 'university-of-chitral'),
  ('university of dir timergara', 'university-of-dir-timergara'),
  ('university of dir', 'university-of-dir-timergara'),
  ('university of shangla', 'university-of-shangla'),
  ('university of lakki marwat', 'university-of-lakki-marwat'),
  ('university of science and technology bannu', 'university-of-science-and-technology-bannu'),
  ('university of science and technology', 'university-of-science-and-technology-bannu'),
  ('ustb', 'university-of-science-and-technology-bannu'),
  ('bacha khan university charsadda', 'bacha-khan-university-charsadda'),
  ('bacha khan university', 'bacha-khan-university-charsadda'),
  ('bkuc', 'bacha-khan-university-charsadda'),
  ('khushal khan khattak university karak', 'khushal-khan-khattak-university-karak'),
  ('khushal khan khattak university', 'khushal-khan-khattak-university-karak'),
  ('kkkuk', 'khushal-khan-khattak-university-karak'),
  ('abbottabad university of science and technology', 'abbottabad-university-of-science-and-technology'),
  ('aust', 'abbottabad-university-of-science-and-technology'),
  ('shaheed benazir bhutto university sheringal', 'shaheed-benazir-bhutto-university-sheringal'),
  ('sbbu sheringal', 'shaheed-benazir-bhutto-university-sheringal'),
  ('shaheed benazir bhutto women university peshawar', 'shaheed-benazir-bhutto-women-university-peshawar'),
  ('shaheed benazir bhutto women university', 'shaheed-benazir-bhutto-women-university-peshawar'),
  ('sbbwu', 'shaheed-benazir-bhutto-women-university-peshawar'),
  ('women university mardan', 'women-university-mardan'),
  ('women university swabi', 'women-university-swabi'),
  ('fata university', 'fata-university'),
  ('university of engineering and technology mardan', 'university-of-engineering-and-technology-mardan'),
  ('uet mardan', 'university-of-engineering-and-technology-mardan'),
  ('university of agriculture dera ismail khan', 'university-of-agriculture-dera-ismail-khan'),
  ('university of technology nowshera', 'university-of-technology-nowshera'),
  ('university of technology', 'university-of-technology-nowshera'),
  ('uotn', 'university-of-technology-nowshera'),
  ('university of engineering and applied sciences swat', 'university-of-engineering-and-applied-sciences-swat'),
  ('university of engineering and applied sciences', 'university-of-engineering-and-applied-sciences-swat'),
  ('ueas', 'university-of-engineering-and-applied-sciences-swat'),
  ('university of veterinary and animal sciences swat', 'university-of-veterinary-and-animal-sciences-swat'),
  ('pak austria fachhochschule institute of applied sciences and technology', 'pak-austria-fachhochschule-institute-of-applied-sciences-and-technology'),
  ('paf iast', 'pak-austria-fachhochschule-institute-of-applied-sciences-and-technology'),
  ('cecos university of information technology and emerging sciences', 'cecos-university-of-information-technology-and-emerging-sciences'),
  ('cecos', 'cecos-university-of-information-technology-and-emerging-sciences'),
  ('city university of science and information technology peshawar', 'city-university-of-science-and-information-technology-peshawar'),
  ('city university of science and information technology', 'city-university-of-science-and-information-technology-peshawar'),
  ('cusit', 'city-university-of-science-and-information-technology-peshawar'),
  ('sarhad university of science and information technology', 'sarhad-university-of-science-and-information-technology'),
  ('suit', 'sarhad-university-of-science-and-information-technology'),
  ('iqra national university peshawar', 'iqra-national-university-peshawar'),
  ('iqra national university', 'iqra-national-university-peshawar'),
  ('abasyn university peshawar', 'abasyn-university-peshawar'),
  ('abasyn university', 'abasyn-university-peshawar'),
  ('gandhara university peshawar', 'gandhara-university-peshawar'),
  ('gandhara university', 'gandhara-university-peshawar'),
  ('qurtuba university of science and information technology', 'qurtuba-university-of-science-and-information-technology'),
  ('northern university nowshera', 'northern-university-nowshera'),
  ('northern university', 'northern-university-nowshera'),
  ('preston university kohat', 'preston-university-kohat'),
  ('university of balochistan', 'university-of-balochistan'),
  ('balochistan university of information technology engineering and management sciences', 'balochistan-university-of-information-technology-engineering-and-management-sciences'),
  ('balochistan university of information technology', 'balochistan-university-of-information-technology-engineering-and-management-sciences'),
  ('buitems', 'balochistan-university-of-information-technology-engineering-and-management-sciences'),
  ('balochistan university of engineering and technology khuzdar', 'balochistan-university-of-engineering-and-technology-khuzdar'),
  ('balochistan university of engineering and technology', 'balochistan-university-of-engineering-and-technology-khuzdar'),
  ('buet khuzdar', 'balochistan-university-of-engineering-and-technology-khuzdar'),
  ('bolan university of medical and health sciences', 'bolan-university-of-medical-and-health-sciences'),
  ('bumhs', 'bolan-university-of-medical-and-health-sciences'),
  ('sardar bahadur khan womens university', 'sardar-bahadur-khan-womens-university'),
  ('sbkwu', 'sardar-bahadur-khan-womens-university'),
  ('lasbela university of agriculture water and marine sciences', 'lasbela-university-of-agriculture-water-and-marine-sciences'),
  ('lasbela university of agriculture', 'lasbela-university-of-agriculture-water-and-marine-sciences'),
  ('luawms', 'lasbela-university-of-agriculture-water-and-marine-sciences'),
  ('university of turbat', 'university-of-turbat'),
  ('university of loralai', 'university-of-loralai'),
  ('university of gwadar', 'university-of-gwadar'),
  ('university of makran panjgur', 'university-of-makran-panjgur'),
  ('university of makran', 'university-of-makran-panjgur'),
  ('mir chakar khan rind university sibi', 'mir-chakar-khan-rind-university-sibi'),
  ('mir chakar khan rind university', 'mir-chakar-khan-rind-university-sibi'),
  ('al hamd islamic university', 'al-hamd-islamic-university'),
  ('pakistan military academy kakul', 'pakistan-military-academy-kakul'),
  ('pakistan military academy', 'pakistan-military-academy-kakul'),
  ('pakistan air force academy risalpur', 'pakistan-air-force-academy-risalpur'),
  ('pakistan air force academy', 'pakistan-air-force-academy-risalpur'),
  ('pakistan naval academy karachi', 'pakistan-naval-academy-karachi'),
  ('pakistan naval academy', 'pakistan-naval-academy-karachi')
on conflict (alias_norm) do nothing;
-- END GENERATED SEED

-- ── Backfill existing members ───────────────────────────────────────────────
select tnr_remap_universities() as members_mapped;

-- ── Verify ──────────────────────────────────────────────────────────────────
select
  (select count(*) from tnr_universities)                                  as universities,
  (select count(*) from tnr_university_aliases)                            as aliases,
  (select count(*) from tnr_university_aliases
     where alias_norm is distinct from tnr_norm_university(alias_norm))    as aliases_not_normal_SHOULD_BE_0,
  (select count(*) from membership_members
     where deleted_at is null and university_id is not null)               as members_matched,
  (select count(*) from membership_members
     where deleted_at is null and university_id is null
       and nullif(trim(organization_name), '') is not null)                as members_unmatched;
