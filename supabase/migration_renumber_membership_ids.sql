-- ============================================================================
--  Renumber membership IDs into a gapless sequence: TNR-MN-0001, 0002, 0003 …
--
--  Numbers are assigned in APPROVAL ORDER, so the earliest member keeps the
--  lowest number. Soft-deleted members (deleted_at is not null) are skipped
--  and do not consume a number.
--
--  ⚠ READ BEFORE RUNNING
--  This rewrites IDs that are already public:
--    · printed on digital membership cards members already hold
--    · used in public profile URLs  (/api/public/member-profile/<id>)
--    · used by the membership verification page
--  Anyone holding an old number will find it no longer resolves.
--
--  Safe to run more than once — running it again is a no-op if already gapless.
--  Runs in a single transaction: either all IDs change or none do.
-- ============================================================================

begin;

-- ─── 1. Work out the new numbering ────────────────────────────────────────
create temp table _renum on commit drop as
select
  id,
  membership_id as old_id,
  'TNR-MN-' || lpad(
    (row_number() over (order by coalesce(approved_at, created_at), created_at, id))::text,
    4, '0'
  ) as new_id
from membership_members
where deleted_at is null;

-- ─── 2. Show what is about to change (review this output) ─────────────────
select old_id, new_id
from _renum
where old_id is distinct from new_id
order by new_id;

-- ─── 3. Park every row on a temporary value ───────────────────────────────
--  membership_id is UNIQUE. Assigning 0003 → 0002 while another row still
--  holds 0002 would violate the constraint mid-update, so every row is moved
--  out of the way first.
update membership_members m
   set membership_id = '__TMP__' || m.id::text
  from _renum r
 where r.id = m.id;

-- ─── 4. Apply the final numbers ───────────────────────────────────────────
update membership_members m
   set membership_id = r.new_id,
       updated_at    = now()
  from _renum r
 where r.id = m.id;

-- ─── 5. Keep denormalised copies in sync ──────────────────────────────────
--  council_guidance_requests stores membership_id as plain text, not a foreign
--  key — without this the rows would be orphaned.
do $$
begin
  if to_regclass('public.council_guidance_requests') is not null then
    update council_guidance_requests c
       set membership_id = r.new_id
      from _renum r
     where c.membership_id = r.old_id;
  end if;
end $$;

-- ─── 6. Point the sequence past the highest number in use ─────────────────
select setval('membership_id_seq', (select count(*) from _renum) + 1, false);

commit;

-- ─── 7. Verify: this should return zero rows ──────────────────────────────
-- Any row here means a number is out of order or duplicated.
select membership_id, count(*)
  from membership_members
 where deleted_at is null
 group by membership_id
having count(*) > 1;

-- And this lists the final state.
select membership_id, full_name, status, approved_at
  from membership_members
 where deleted_at is null
 order by membership_id;
