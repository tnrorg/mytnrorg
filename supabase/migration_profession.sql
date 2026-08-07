-- Profession / field, added to the membership application and member record.
--
-- Separate from `field_of_study`, which records what the applicant STUDIED.
-- A Computer Science graduate working in banking answers those two
-- differently, and merging them would lose whichever one matters.
--
-- `profession` holds the chosen category (always one of the fixed list, or
-- 'Other'); `profession_other` holds the free text only when 'Other' was
-- chosen. Keeping the category separate is what lets the profession
-- statistics group cleanly — storing the typed text in the same column would
-- scatter one-off spellings across the chart.
--
-- Nullable with no default: every application and member that already exists
-- predates this question and must keep working.
--
-- Additive and safe to run more than once. Touches nothing in the election
-- system.

alter table membership_applications add column if not exists profession       text;
alter table membership_applications add column if not exists profession_other text;

alter table membership_members add column if not exists profession       text;
alter table membership_members add column if not exists profession_other text;

create index if not exists ix_members_profession on membership_members (profession);
