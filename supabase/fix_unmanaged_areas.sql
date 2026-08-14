-- ════════════════════════════════════════════════════════════════════════════
-- Reassign members whose Union Council or village does not match the managed
-- area list.
--
-- NOT a migration. Run the SELECTs, read what they say, then run only the
-- UPDATE you actually need with the names filled in. Nothing here changes data
-- until you edit and run step 3.
--
-- WHY THESE APPEAR
-- The overview groups members by the exact text in `union_council`. A member
-- who typed "Mendi" is not the same string as the managed "UC MENDI", so they
-- become a council of their own with one member in it. Nothing is broken —
-- the grouping is honest about what was recorded.
-- ════════════════════════════════════════════════════════════════════════════


-- ── 1. What the managed list actually contains ──────────────────────────────
-- Copy the exact spelling from here. Case and punctuation must match.
select id, name, active
  from membership_union_councils
 order by sort_order, name;


-- ── 2. Which members are on a value that is not on that list ────────────────
-- These are the ones producing the extra cards.
select m.membership_id,
       m.full_name,
       m.union_council as recorded_uc,
       m.village       as recorded_village
  from membership_members m
 where m.deleted_at is null
   and coalesce(m.union_council, '') <> ''
   and not exists (
     select 1 from membership_union_councils uc
      where lower(trim(uc.name)) = lower(trim(m.union_council))
   )
 order by m.union_council, m.full_name;


-- ── 3. THE FIX — edit the names, then run ───────────────────────────────────
-- Replace the right-hand value with the EXACT managed name from step 1.
-- Run one statement at a time and check the "rows affected" count matches
-- what step 2 showed. Uncomment to use.

-- update membership_members
--    set union_council = 'UC MENDI',            -- exact managed name
--        updated_at    = now()
--  where deleted_at is null
--    and lower(trim(union_council)) = lower(trim('Mendi'));

-- update membership_members
--    set union_council = 'UC BAGORDO/BAGHIZA',  -- exact managed name
--        updated_at    = now()
--  where deleted_at is null
--    and lower(trim(union_council)) = lower(trim('UC BAGORDO/BAGHIZA'));


-- ── 4. Villages ─────────────────────────────────────────────────────────────
-- A village marked * is simply absent from the managed list. Usually the right
-- answer is to ADD it under Admin → Areas rather than to move the member —
-- the member does live there.
select m.village, m.union_council, count(*) as members
  from membership_members m
 where m.deleted_at is null
   and coalesce(m.village, '') <> ''
   and not exists (
     select 1 from membership_villages v
      where lower(trim(v.name)) = lower(trim(m.village))
   )
 group by m.village, m.union_council
 order by members desc, m.village;


-- ── 5. Confirm ──────────────────────────────────────────────────────────────
-- Re-run step 2 afterwards. An empty result means every member now sits under
-- a managed Union Council and the extra cards are gone.
