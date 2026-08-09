-- Let a member choose whether their photograph is shown publicly.
--
-- Aimed at women, for whom publishing a photograph is a real privacy concern
-- in this community, but the column applies to everyone — a men-only control
-- would be odd and a women-only one signals that the choice is unusual.
--
-- Safe to run more than once.

alter table membership_members
  add column if not exists photo_public boolean not null default true;

comment on column membership_members.photo_public is
  'When false the public APIs withhold photo_url entirely and the site renders a placeholder icon. Enforced server-side — the URL is never sent to the browser.';

-- Existing members keep their photo visible: they uploaded it on the
-- understanding that it would appear, and silently hiding it would be its own
-- kind of surprise. The control is opt-out, and prominent in the portal.
update membership_members set photo_public = true where photo_public is null;

select count(*) filter (where photo_public) as visible,
       count(*) filter (where not photo_public) as hidden
  from membership_members where deleted_at is null;
