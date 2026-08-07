-- Link a leadership profile back to the member it belongs to.
--
-- Why: the link only existed in one direction (membership_members
-- .leadership_profile_id), so deleting a member left their public council card
-- behind on the website — an orphaned profile for a person who no longer
-- exists. The admin Delete button cleaned this up, but a direct SQL delete did
-- not, and the database itself had no rule to enforce it.
--
-- With this column the database guarantees it: remove the member and the
-- profile goes too, however the deletion happens. Profiles created manually
-- for someone who is not a registered member keep member_id null and are
-- unaffected.
-- Safe to run more than once.

alter table leadership_profiles
  add column if not exists member_id uuid
    references membership_members(id) on delete cascade;

create index if not exists ix_leadership_member on leadership_profiles (member_id);

-- Backfill from the existing reverse link.
update leadership_profiles lp
set member_id = m.id
from membership_members m
where m.leadership_profile_id = lp.id
  and lp.member_id is null;

-- Clean up any profiles already orphaned by an earlier delete.
-- Only touches rows that were linked to a member who no longer exists.
delete from leadership_profiles lp
where lp.member_id is not null
  and not exists (select 1 from membership_members m where m.id = lp.member_id);
