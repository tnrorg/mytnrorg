-- ════════════════════════════════════════════════════════════════════════════
-- "How did you hear about us?"
--
-- Safe to run more than once. Adds columns only; no existing row is changed.
--
-- Added to BOTH tables on purpose. The answer is given on the application, but
-- it is worth keeping once that application becomes a member — otherwise the
-- question can only ever be asked of people who have not joined yet, which is
-- exactly the wrong half of the data. Approval copies it across.
--
-- Existing members and older applications keep NULL, which reads as "not
-- asked" rather than "no answer". Reports should exclude them instead of
-- counting them as an empty category, or every chart will be dominated by a
-- blank bar representing everyone who applied before the question existed.
-- ════════════════════════════════════════════════════════════════════════════

-- ── Applications ────────────────────────────────────────────────────────────
alter table membership_applications
  add column if not exists heard_about        text,
  add column if not exists heard_about_detail text,   -- free text, only for "Other"
  add column if not exists referred_by_name   text;   -- only for the referral option

-- ── Members ─────────────────────────────────────────────────────────────────
alter table membership_members
  add column if not exists heard_about        text,
  add column if not exists heard_about_detail text,
  add column if not exists referred_by_name   text;

/* Only the six known answers, or NULL.
 *
 * Constrained in the database as well as the API because this column exists to
 * be COUNTED. One row saying "facebook" and another saying "Facebook" makes
 * two categories out of one, and nobody notices until the totals are already
 * being quoted in a meeting.
 *
 * NULL is allowed and means the question was never asked — every record
 * created before this migration. */
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'membership_applications_heard_about_valid') then
    alter table membership_applications
      add constraint membership_applications_heard_about_valid
      check (heard_about is null or heard_about in (
        'Facebook', 'LinkedIn', 'YouTube', 'Other Social Media',
        'Referred by a Registered Member', 'Other'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'membership_members_heard_about_valid') then
    alter table membership_members
      add constraint membership_members_heard_about_valid
      check (heard_about is null or heard_about in (
        'Facebook', 'LinkedIn', 'YouTube', 'Other Social Media',
        'Referred by a Registered Member', 'Other'));
  end if;
end $$;

-- Reporting reads this constantly and writes to it once.
create index if not exists idx_applications_heard_about on membership_applications(heard_about);
create index if not exists idx_members_heard_about      on membership_members(heard_about);

comment on column membership_members.heard_about is
  'Referral source given on the application. NULL means the question predates '
  'this member — exclude those rows from reports rather than counting them.';

-- ── verify ──────────────────────────────────────────────────────────────────
-- Where members are actually coming from (NULL = joined before we asked):
select coalesce(heard_about, '— not asked —') as source, count(*)
  from membership_members
 where deleted_at is null
 group by 1
 order by 2 desc;

-- Who is bringing people in:
select referred_by_name, count(*) as referrals
  from membership_members
 where referred_by_name is not null and deleted_at is null
 group by 1
 order by 2 desc;
