-- ════════════════════════════════════════════════════════════════════════════
-- Global search — analytics only
--
-- SEARCH ITSELF NEEDS NO MIGRATION. It reads the existing public tables and
-- works without this file. This adds one small table so admins can see what
-- visitors look for and what they fail to find.
--
-- WHAT IS STORED: a daily COUNT per search term and per result category.
-- WHAT IS NOT:    who searched. No member id, no IP address, no session, no
--                 timestamp finer than the day. There is no per-person search
--                 history to leak, subpoena or misuse, because none is kept.
--
-- Adds nothing to and changes nothing in any existing table.
-- Rollback:  drop function if exists tnr_search_log(text, text, integer);
--            drop table if exists search_stats_daily;
-- Safe to run more than once.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists search_stats_daily (
  day       date    not null default current_date,
  kind      text    not null,            -- term | zero | click
  key       text    not null,            -- the normalised term, or a result type
  hits      integer not null default 0,
  ms_total  bigint  not null default 0,  -- summed response time, for the average
  primary key (day, kind, key),
  constraint chk_ssd_kind check (kind in ('term', 'zero', 'click')),
  constraint chk_ssd_key  check (length(key) between 1 and 60)
);
create index if not exists idx_ssd_recent on search_stats_daily (day desc, kind);

-- One atomic increment, so two searches in the same instant both count.
create or replace function tnr_search_log(p_kind text, p_key text, p_ms integer default 0)
returns void language sql as $$
  insert into search_stats_daily (day, kind, key, hits, ms_total)
  values (current_date, p_kind, left(p_key, 60), 1, greatest(coalesce(p_ms, 0), 0))
  on conflict (day, kind, key)
  do update set hits = search_stats_daily.hits + 1,
                ms_total = search_stats_daily.ms_total + excluded.ms_total;
$$;

-- Deny-all: reachable only through the server's service-role client.
alter table search_stats_daily enable row level security;

select count(*) as search_stats_table_ready
  from information_schema.tables where table_name = 'search_stats_daily';
