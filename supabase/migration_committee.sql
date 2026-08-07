-- Roles + Committee Vote Entry (Super Admin). Run in Supabase → SQL Editor.

-- 1) Standardize role values
update admin_users set role = 'super_admin' where role in ('superadmin','super admin');

-- 2) Protected table for Super-Admin committee vote entries (who entered which ballot).
--    The actual vote still lives in `votes` so it counts in combined public totals.
create table if not exists committee_vote_entries (
  id            uuid primary key default gen_random_uuid(),
  election_id   uuid not null references elections(id) on delete cascade,
  member_id     uuid not null references members(id) on delete cascade,
  candidate_id  uuid not null references candidates(id) on delete cascade,
  position_id   int,
  entered_by    text not null,
  created_at    timestamptz not null default now(),
  constraint uq_committee_once unique (election_id, member_id)
);
alter table committee_vote_entries enable row level security;  -- no public policies: service-role only
