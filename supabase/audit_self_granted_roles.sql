-- Find members who were approved into a leadership role.
--
-- Until now, approval defaulted to whatever the applicant selected on the
-- form, so anyone who ticked "Advisory Council" or "Central Executive
-- Committee" was granted it the moment an admin pressed Approve. Run this to
-- see who currently holds one and check each against the real office bearers.
--
-- Read-only. Nothing is changed.

select
  m.membership_id,
  m.full_name,
  m.role                       as granted_role,
  a.applied_role               as requested_on_form,
  case
    when a.applied_role = m.role then 'SELF-SELECTED — verify'
    else 'granted by admin'
  end                          as how,
  m.approved_by,
  m.approved_at::date          as approved_on,
  (lp.id is not null)          as has_public_profile
from membership_members m
left join membership_applications a on a.id = m.application_id
left join leadership_profiles lp    on lp.member_id = m.id
where m.deleted_at is null
  and m.role in ('advisory', 'cec')
order by how desc, m.approved_at;

-- To correct one, either use Admin → Members → Membership Type, or:
--   update membership_members set role = 'general' where membership_id = 'TNR-MN-0000';
--
-- A public leadership profile is a separate row and is NOT removed by the
-- above. Check leadership_profiles for anyone you demote:
--   select id, name, body, active from leadership_profiles where member_id = '<uuid>';
