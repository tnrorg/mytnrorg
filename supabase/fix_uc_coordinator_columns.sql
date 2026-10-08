-- ============================================================================
--  TNR — Repair uc_coordinator_applications (and rounds) to the current shape
--  Run once in the Supabase SQL editor. Safe to run more than once.
--
--  WHY THIS EXISTS
--
--  migration_uc_coordinator.sql uses `create table if not exists`. The table
--  was already present in an older shape, so the migration skipped it and the
--  newer columns were never added. Every submission then failed with
--  "column commitment_accepted ... does not exist", which the member page
--  reported as "Coordinator applications are not switched on yet".
--
--  This adds every column the application code writes, if missing. Nothing is
--  dropped, renamed or overwritten.
-- ============================================================================

-- ── Rounds ──────────────────────────────────────────────────────────────────
alter table uc_coordinator_rounds add column if not exists title           text not null default 'TNR Union Council Coordinator';
alter table uc_coordinator_rounds add column if not exists summary         text not null default '';
alter table uc_coordinator_rounds add column if not exists status          text not null default 'draft';
alter table uc_coordinator_rounds add column if not exists closes_on       date;
alter table uc_coordinator_rounds add column if not exists announcement_id uuid;
alter table uc_coordinator_rounds add column if not exists opened_by       text not null default '';
alter table uc_coordinator_rounds add column if not exists opened_at       timestamptz;
alter table uc_coordinator_rounds add column if not exists closed_at       timestamptz;
alter table uc_coordinator_rounds add column if not exists created_at      timestamptz not null default now();
alter table uc_coordinator_rounds add column if not exists updated_at      timestamptz not null default now();

-- ── Applications ────────────────────────────────────────────────────────────
alter table uc_coordinator_applications add column if not exists reference_no        text;
alter table uc_coordinator_applications add column if not exists full_name           text not null default '';
alter table uc_coordinator_applications add column if not exists membership_id       text not null default '';
alter table uc_coordinator_applications add column if not exists union_council       text not null default '';
alter table uc_coordinator_applications add column if not exists permanent_address   text not null default '';
alter table uc_coordinator_applications add column if not exists current_residence   text not null default '';
alter table uc_coordinator_applications add column if not exists whatsapp            text not null default '';
alter table uc_coordinator_applications add column if not exists email               text not null default '';
alter table uc_coordinator_applications add column if not exists education           text not null default '';
alter table uc_coordinator_applications add column if not exists profession          text not null default '';
alter table uc_coordinator_applications add column if not exists motivation          text not null default '';
alter table uc_coordinator_applications add column if not exists commitment_accepted boolean not null default false;
alter table uc_coordinator_applications add column if not exists commitment_text     text not null default '';
alter table uc_coordinator_applications add column if not exists submitted_at        timestamptz not null default now();
alter table uc_coordinator_applications add column if not exists status              text not null default 'new';
alter table uc_coordinator_applications add column if not exists admin_notes         text not null default '';
alter table uc_coordinator_applications add column if not exists reviewed_by         text not null default '';
alter table uc_coordinator_applications add column if not exists reviewed_at         timestamptz;
alter table uc_coordinator_applications add column if not exists created_at          timestamptz not null default now();
alter table uc_coordinator_applications add column if not exists updated_at          timestamptz not null default now();

-- ── Indexes and sequence the code relies on ─────────────────────────────────
create unique index if not exists uc_apps_reference_no on uc_coordinator_applications (reference_no);
create unique index if not exists uc_apps_once   on uc_coordinator_applications (round_id, member_id);
create index        if not exists uc_apps_review on uc_coordinator_applications (round_id, status, created_at desc);
create index        if not exists uc_apps_by_uc  on uc_coordinator_applications (round_id, union_council);
create sequence     if not exists uc_coordinator_seq start 1;

alter table uc_coordinator_rounds       enable row level security;
alter table uc_coordinator_applications enable row level security;

-- Tell the API layer about the new columns straight away.
notify pgrst, 'reload schema';

-- ── Check: any OLD column that is required but has no default ──────────────
/* The app only writes the columns above. A leftover column from the older
 * table that is NOT NULL with no default would still block every insert.
 * This should return NO rows; if it returns any, send them to the developer. */
select column_name, data_type
from information_schema.columns
where table_name = 'uc_coordinator_applications'
  and is_nullable = 'NO'
  and column_default is null
  and column_name not in ('id', 'round_id', 'member_id');
