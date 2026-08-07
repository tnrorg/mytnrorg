-- Current address and organisation, added to the membership application and
-- the member record.
--
-- Both readable name and code are stored for country and state:
--   the NAME is what a person reads on the review page, in admin and on any
--   export; the CODE is what the next dropdown level queries with. Keeping
--   only the name would mean re-deriving the code by string match, which
--   breaks the moment a dataset renames "Türkiye" or "Czechia".
--
-- Every column is nullable with no default on purpose. Applications already in
-- the table predate these questions and must keep working — a NOT NULL here
-- would break the admin list for every existing record.
--
-- Additive and safe to run more than once. Touches nothing in the election
-- system.

-- ── Applications ────────────────────────────────────────────────────────────
alter table membership_applications add column if not exists current_country        text;
alter table membership_applications add column if not exists current_country_code   text;
alter table membership_applications add column if not exists current_state_province text;
alter table membership_applications add column if not exists current_state_code     text;
alter table membership_applications add column if not exists current_city           text;
-- One column for every kind of position. The FORM changes the label —
-- "Institution / University" for a student, "Department / Organisation" for a
-- government employee — but they all describe the same thing, and separate
-- columns would mean every report had to coalesce across six of them.
alter table membership_applications add column if not exists organization_name      text;

-- ── Members ─────────────────────────────────────────────────────────────────
alter table membership_members add column if not exists current_country        text;
alter table membership_members add column if not exists current_country_code   text;
alter table membership_members add column if not exists current_state_province text;
alter table membership_members add column if not exists current_state_code     text;
alter table membership_members add column if not exists current_city           text;
alter table membership_members add column if not exists organization_name      text;

-- Members abroad are worth being able to count and filter on.
create index if not exists ix_members_current_country on membership_members (current_country_code);
