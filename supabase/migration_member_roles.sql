-- ── One registration form, four membership types ──────────────────────────
-- The applicant chooses a type at the top of the form; the rest of the form is
-- identical for everyone. The type is a REQUEST, not a grant: the admin decides
-- the final role at approval, so nobody can self-appoint to the Advisory
-- Council or the Executive Committee.
-- Safe to run more than once.

alter table membership_applications
  add column if not exists applied_role text;

alter table membership_members
  add column if not exists role text not null default 'general';

-- Roles are constrained so a typo cannot silently create a fifth tier.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'chk_member_role') then
    alter table membership_members add constraint chk_member_role
      check (role in ('general', 'uc_team', 'cec', 'advisory'));
  end if;
end $$;

create index if not exists ix_members_role on membership_members (role);

-- Links a member account to their public leadership profile, so the portal can
-- show "edit my council profile" to the right people.
alter table membership_members
  add column if not exists leadership_profile_id uuid references leadership_profiles(id) on delete set null;
