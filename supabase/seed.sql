-- ============================================================================
--  TNR — Seed data (run AFTER schema.sql)
--  Default admin:  username = admin   password = admin123   (CHANGE after login)
--  Password is hashed with pgcrypto bcrypt ($2a$) — compatible with bcryptjs.
-- ============================================================================

-- Organization
insert into organizations (name, short_name, values_ur, logo_url)
select 'Tehreek-e-Nojawanan Roundu', 'TNR', 'اتحاد، شعور، عمل', '/tnr-logo.png'
where not exists (select 1 from organizations);

-- Unions / areas
insert into unions (union_name, union_code) values
  ('Union Council Roundu',  'UC-01'),
  ('Union Council Ghasing', 'UC-02'),
  ('Union Council Kalam',   'UC-03'),
  ('Union Council Bahrain', 'UC-04'),
  ('Union Council Madyan',  'UC-05')
on conflict (union_code) do nothing;

-- Default admin (bcrypt via pgcrypto)
insert into admin_users (username, password_hash, full_name, role)
select 'admin', crypt('admin123', gen_salt('bf', 10)), 'TNR Administrator', 'super_admin'
where not exists (select 1 from admin_users where username = 'admin');

-- Sample election (Draft) so the dashboard is not empty on first run
insert into elections (title, description, status, starts_at, ends_at)
select 'TNR General Council Election 2026',
       'Internal election for the executive council of Tehreek-e-Nojawanan Roundu.',
       'Draft',
       now() + interval '1 day',
       now() + interval '3 day'
where not exists (select 1 from elections);

-- Positions for the sample election
insert into positions (election_id, title, sort_order)
select e.id, p.title, p.ord
from elections e
cross join (values
  ('President',1),('Vice President',2),('General Secretary',3),
  ('Finance Secretary',4),('Committee Member',5)
) as p(title, ord)
where e.title = 'TNR General Council Election 2026'
  and not exists (select 1 from positions pp where pp.election_id = e.id);

-- Result settings for sample election (fairness defaults: hide live counts)
insert into result_settings (election_id)
select id from elections
where title = 'TNR General Council Election 2026'
  and id not in (select election_id from result_settings);
