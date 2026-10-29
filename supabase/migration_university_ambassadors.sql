-- ════════════════════════════════════════════════════════════════════════════
--  TNR — University Ambassadors
--  Run once in the Supabase SQL editor.
--
--  WHY THIS IS REQUIRED, NOT OPTIONAL
--
--  Two CHECK constraints currently list the tiers that existed when the
--  platform was built, and Postgres enforces both on every write:
--
--    membership_members.chk_member_role
--      check (role in ('general','uc_team','cec','advisory'))
--
--    leadership_profiles.body
--      check (body in ('advisory','executive'))
--
--  Until they are widened, choosing "University Ambassador" on the membership
--  form fails at the database, and the new public section cannot hold a single
--  profile. Shipping the code without this would look exactly like the feature
--  being broken — which is the one failure mode worth going out of the way to
--  avoid.
--
--  WHY AN AMBASSADOR IS A MEMBER ROLE *AND* A LEADERSHIP BODY
--
--  The two answer different questions. `role` on membership_members is what a
--  person IS in the organisation — it drives their portal, their card and
--  their certificate. `body` on leadership_profiles is which PUBLIC ROSTER a
--  profile belongs to. A member can hold the role without yet having a public
--  profile written for them, and that is the normal state for the first few
--  weeks after someone is appointed.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. The membership role ──────────────────────────────────────────────────
/* Dropped and recreated: a CHECK cannot be altered in place. Both statements
 * run in one implicit transaction, so the table is never briefly left without
 * the constraint — if the ADD fails the DROP rolls back with it. */
alter table membership_members drop constraint if exists chk_member_role;

alter table membership_members add constraint chk_member_role
  check (role in ('general', 'uc_team', 'cec', 'advisory', 'university_ambassador'));

/* The applied_role column on membership_applications is deliberately NOT
 * constrained — it never was. It records what an applicant ASKED for, and the
 * admin sets the real role at approval, so a stray value there can never
 * become a membership tier. */

-- ── 2. The public roster ────────────────────────────────────────────────────
/* leadership_profiles.body is an inline column constraint, so Postgres named
 * it automatically. The name follows the standard pattern
 * <table>_<column>_check; the IF EXISTS makes this safe either way, and the
 * DO block below catches any installation where it was named differently. */
do $$
declare c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    where rel.relname = 'leadership_profiles'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%body%'
  loop
    execute format('alter table leadership_profiles drop constraint %I', c.conname);
  end loop;
end $$;

alter table leadership_profiles add constraint leadership_profiles_body_check
  check (body in ('advisory', 'executive', 'ambassador'));

-- ── 3. Make the new roster easy to read ─────────────────────────────────────
/* The existing (body, sort_order) index already covers the public query. This
 * one is for the opposite direction: "which members are ambassadors", which is
 * what the membership screen and the directory filter ask. */
create index if not exists ix_members_ambassador
  on membership_members (role) where role = 'university_ambassador';

-- ════════════════════════════════════════════════════════════════════════════
--  Two constraints widened and one partial index added. No row is altered or
--  deleted, every existing member keeps their role, every existing leadership
--  profile keeps its body, and the file is safe to run twice.
-- ════════════════════════════════════════════════════════════════════════════
