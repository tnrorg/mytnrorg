-- Date of birth replaces the free-typed Age field on the application form.
--
-- An age typed as a number is wrong the day after it is entered and cannot be
-- verified; a date of birth stays correct and age can be derived from it at
-- any point. `age` is kept and still populated so nothing that reads it breaks.
--
-- Date of birth is personal data: it is deliberately NOT in the allow-list of
-- any public endpoint, so it cannot appear in the members directory or on a
-- profile page.
-- Safe to run more than once.

alter table membership_applications add column if not exists date_of_birth date;
alter table membership_members      add column if not exists date_of_birth date;
