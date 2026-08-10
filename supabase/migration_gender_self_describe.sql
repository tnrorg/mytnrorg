-- ════════════════════════════════════════════════════════════════════════════
-- Gender: free-text box for "Prefer to self-describe"
--
-- Safe to run more than once. Adds one nullable column to each of two tables
-- and changes no existing row.
--
-- `gender` stays exactly as it is — a free-text column holding the chosen
-- option. The new column holds the typed words, and ONLY when the choice was
-- "Prefer to self-describe". Same arrangement the profession field already
-- uses (profession + profession_other), so there is one pattern in this
-- schema rather than two.
--
-- Storing the text in its own column rather than overwriting `gender` keeps
-- every existing count, filter and export working: anything grouping by
-- `gender` still sees a fixed set of values instead of 300 unique strings.
-- ════════════════════════════════════════════════════════════════════════════

alter table membership_applications
  add column if not exists gender_self_described text;

alter table membership_members
  add column if not exists gender_self_described text;

comment on column membership_members.gender_self_described is
  'Free text, set only when gender = ''Prefer to self-describe''. Shown in place of the option wherever gender is displayed.';

-- ── verify ──────────────────────────────────────────────────────────────────
-- Expect the new column present and empty. Existing members are untouched.
select gender,
       count(*) as members,
       count(gender_self_described) as self_described
  from membership_members
 where deleted_at is null
 group by gender
 order by members desc;
