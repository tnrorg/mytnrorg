-- MULTI-POSITION BALLOT
-- One vote per member PER POSITION (not one vote per election).
-- Run this once in the Supabase SQL editor.

begin;

-- 1. Remove the old "one vote per election" rule
alter table votes drop constraint if exists uq_one_vote_per_member_election;

-- 2. Every vote must belong to a position
delete from votes where position_id is null;
alter table votes alter column position_id set not null;

-- 3. New rule: one vote per member, per position, per election
alter table votes drop constraint if exists uq_one_vote_per_member_position;
alter table votes add constraint uq_one_vote_per_member_position
  unique (election_id, member_id, position_id);

create index if not exists idx_votes_position on votes(election_id, position_id);

commit;

-- 4. Canonical organization name
update organizations set name = 'Tehreek-e-Nojawanan Roundu', short_name = 'TNR';
