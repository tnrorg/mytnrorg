-- Admin permission areas
-- ---------------------------------------------------------------------------
-- Lets a super admin restrict an admin account to particular parts of the
-- panel — for example, an election officer who should see the Election Portal
-- and nothing else.
--
-- SAFE TO RUN ON PRODUCTION. It adds one column and changes no existing data
-- beyond giving current admins every area, which is exactly what they have
-- today. Nobody loses access at the moment this deploys; permissions are
-- narrowed deliberately, afterwards, from the Admin Accounts screen.
--
-- Run it BEFORE deploying the code. The API reads this column, and Postgres
-- rejects a whole query for one unknown column — deploying first would break
-- every admin route until the migration caught up.

-- 1. The column. Default is every area, so an admin created by an older code
--    path is not silently locked out of everything.
alter table admin_users
  add column if not exists scopes text[] not null
  default array['election','membership','content','opinions','inbox','cec'];

-- 2. Existing rows keep what they already had: full access.
--    `is null` covers the case where the column was added by hand without a
--    default at some earlier point.
update admin_users
   set scopes = array['election','membership','content','opinions','inbox','cec']
 where scopes is null or cardinality(scopes) = 0;

-- 3. Reject anything that is not a real area.
--    The API validates too, but a constraint is the thing that still holds
--    when someone edits a row directly in the Supabase table editor.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'admin_users_scopes_valid'
  ) then
    alter table admin_users
      add constraint admin_users_scopes_valid
      check (scopes <@ array['election','membership','content','opinions','inbox','cec']::text[]);
  end if;
end $$;

comment on column admin_users.scopes is
  'Permission areas for a normal admin. Ignored for super_admin, who always '
  'holds every area — rank is not stored here, so no scope edit can grant it.';

-- Check what each account can reach:
--   select username, role, scopes from admin_users order by role, username;
