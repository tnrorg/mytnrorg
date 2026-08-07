-- Every approved member appears in the public directory.
--
-- `public_visible` was created as opt-IN (default false), so the directory sat
-- empty: not one member had switched it on, because nobody knew it existed.
-- TNR's decision is that membership is public by nature — a member directory
-- with no members in it serves nobody.
--
-- What this changes: name, photo, village, Union Council, profession and
-- membership ID become visible on the public site for approved members.
--
-- What it does NOT change: email, mobile, WhatsApp, date of birth, CNIC,
-- street address, application answers and admin notes are not in any public
-- endpoint's column list and stay private regardless of this flag.
--
-- The column is kept rather than dropped. It is now an ADMIN override for the
-- rare case where someone must be taken off the public site — a safety
-- concern, a request from a family — and losing it would mean the only way to
-- hide a member is to delete them.
--
-- Safe to run more than once.

alter table membership_members alter column public_visible set default true;

-- Existing members: everyone approved so far was hidden by the old default.
update membership_members
set public_visible = true
where public_visible is distinct from true
  and deleted_at is null;
