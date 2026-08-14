-- ════════════════════════════════════════════════════════════════════════════
-- Read counter for Opinions
--
-- Safe to run more than once. One column plus one function; no row changes.
--
-- Counted with an atomic increment in the database rather than
-- "read the number, add one, write it back" in the API. Two people opening the
-- same piece at the same moment both read the same value and both write the
-- same result, so one of the reads is lost. At a hundred readers a minute that
-- undercount is the whole point of the feature.
-- ════════════════════════════════════════════════════════════════════════════

alter table opinions
  add column if not exists views bigint not null default 0;

comment on column opinions.views is
  'Times the article page has been opened. One per browser session, not per refresh.';

/* Atomic +1.
 *
 * SECURITY DEFINER with a pinned search_path: the function runs with the
 * owner's rights so it can update a row the caller cannot otherwise touch,
 * and pinning the path stops anyone shadowing `opinions` with their own table
 * to make it write somewhere else.
 *
 * It only ever increments the counter on a PUBLISHED piece — it cannot be
 * used to reach any other column, or to discover whether an unpublished
 * opinion exists.
 */
create or replace function bump_opinion_views(p_slug text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v bigint;
begin
  update opinions
     set views = views + 1
   where slug = p_slug
     and status = 'published'
  returning views into v;
  return coalesce(v, 0);
end;
$$;

-- ── verify ──────────────────────────────────────────────────────────────────
select slug, published_title, views
  from opinions
 where status = 'published'
 order by views desc;
