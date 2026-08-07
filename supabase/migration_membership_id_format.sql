-- Membership numbers become permanent and year-free: TNR-MN-0001, TNR-MN-0002 …
-- Safe to run more than once.

-- 1. Record the new format in settings (display only).
update membership_settings
   set value = 'TNR-MN-{0000}'
 where key = 'membership_id_format';

-- 2. Renumber existing members in the order they were approved, so the
--    earliest member keeps the lowest number.
with ordered as (
  select id, row_number() over (order by coalesce(approved_at, created_at), created_at) as rn
    from membership_members
)
update membership_members m
   set membership_id = 'TNR-MN-' || lpad(o.rn::text, 4, '0')
  from ordered o
 where o.id = m.id;

-- 3. Point the sequence at the next free number so new approvals continue cleanly.
select setval('membership_id_seq', (select count(*) from membership_members) + 1, false);
