-- Institutions register: photo gallery, and where the absent teachers actually are.
--
-- `elsewhere_note` records the STATION — the school and city a teacher posted
-- here is actually serving at. It is deliberately about places, not people:
-- naming an individual teacher on a public page is a different kind of claim
-- and carries a different kind of risk. The station is the fact that matters
-- for accountability, and anyone who needs the name can ask the department.
--
-- Additive and safe to run more than once.

alter table tnr_institutions add column if not exists gallery        text[] not null default '{}';
alter table tnr_institutions add column if not exists elsewhere_note text   not null default '';
