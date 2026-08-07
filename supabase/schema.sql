-- ============================================================================
--  Tehreek-e-Nojawanan Roundu (TNR) — Election Portal
--  PostgreSQL / Supabase schema + seed
--  Run this in Supabase → SQL Editor (or via the Supabase CLI).
-- ============================================================================

create extension if not exists "pgcrypto";

-- ─── organizations ──────────────────────────────────────────────────────────
create table if not exists organizations (
  id           uuid primary key default gen_random_uuid(),
  name         text not null default 'Tehreek-e-Nojawanan Roundu',
  short_name   text not null default 'TNR',
  logo_url     text,
  values_ur    text default 'اتحاد، شعور، عمل',
  created_at   timestamptz not null default now()
);

-- ─── unions / areas ─────────────────────────────────────────────────────────
create table if not exists unions (
  id           serial primary key,
  union_name   text not null,
  union_code   text unique,
  created_at   timestamptz not null default now()
);

-- ─── admin users ────────────────────────────────────────────────────────────
create table if not exists admin_users (
  id            uuid primary key default gen_random_uuid(),
  username      text not null unique,
  password_hash text not null,
  full_name     text,
  role          text not null default 'admin',   -- admin | superadmin
  created_at    timestamptz not null default now()
);

-- ─── members (voters) ───────────────────────────────────────────────────────
create table if not exists members (
  id             uuid primary key default gen_random_uuid(),
  full_name      text not null,
  member_code    text,
  father_name    text,
  cnic           text,
  mobile         text not null,                    -- registered mobile (E.164, unique)
  whatsapp       text,
  email          text,
  village        text,
  union_id       int references unions(id) on delete set null,
  gender         text,                             -- Male | Female | Other
  status         text not null default 'Pending',  -- Pending | Approved | Blocked
  voting_status  text not null default 'Not Voted',-- Not Voted | Voted  (per active election convenience flag)
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint uq_member_mobile unique (mobile)
);
create index if not exists idx_members_status on members(status);
create index if not exists idx_members_union on members(union_id);
create index if not exists idx_members_code on members(member_code);

-- ─── elections ──────────────────────────────────────────────────────────────
create table if not exists elections (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  description     text,
  starts_at       timestamptz,
  ends_at         timestamptz,
  status          text not null default 'Draft',   -- Draft | Active | Paused | Ended
  voter_list_locked boolean not null default false,
  locked_at       timestamptz,
  locked_by       text,
  result_published boolean not null default false,
  result_published_at timestamptz,
  created_at      timestamptz not null default now()
);

-- ─── positions (per election) ───────────────────────────────────────────────
create table if not exists positions (
  id           serial primary key,
  election_id  uuid not null references elections(id) on delete cascade,
  title        text not null,                    -- President, Vice President, ...
  sort_order   int not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists idx_positions_election on positions(election_id);

-- ─── candidates ─────────────────────────────────────────────────────────────
create table if not exists candidates (
  id            uuid primary key default gen_random_uuid(),
  election_id   uuid not null references elections(id) on delete cascade,
  position_id   int references positions(id) on delete set null,
  name          text not null,
  photo_url     text,
  symbol        text,
  symbol_url    text,
  union_id      int references unions(id) on delete set null,
  manifesto     text,
  education     text,
  status        text not null default 'Active',   -- Active | Hidden
  sort_order    int not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists idx_candidates_election on candidates(election_id);
create index if not exists idx_candidates_position on candidates(position_id);

-- ─── locked voter list snapshot ─────────────────────────────────────────────
create table if not exists locked_voter_list (
  id            uuid primary key default gen_random_uuid(),
  election_id   uuid not null references elections(id) on delete cascade,
  member_id     uuid not null references members(id) on delete cascade,
  full_name     text,
  mobile        text,
  union_id      int,
  snapshot_at   timestamptz not null default now(),
  constraint uq_locked_member unique (election_id, member_id)
);
create index if not exists idx_locked_election on locked_voter_list(election_id);

-- ─── OTP verifications ──────────────────────────────────────────────────────
create table if not exists otp_verifications (
  id            uuid primary key default gen_random_uuid(),
  election_id   uuid references elections(id) on delete cascade,
  member_id     uuid references members(id) on delete cascade,
  mobile        text not null,
  code_hash     text not null,                    -- hashed 6-digit code
  channel       text,                             -- whatsapp | sms
  expires_at    timestamptz not null,
  consumed      boolean not null default false,
  attempts      int not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists idx_otp_lookup on otp_verifications(election_id, member_id, consumed);

-- ─── votes ──────────────────────────────────────────────────────────────────
-- One member = one vote per election  → enforced by unique(election_id, member_id)
create table if not exists votes (
  id            uuid primary key default gen_random_uuid(),
  election_id   uuid not null references elections(id) on delete cascade,
  member_id     uuid not null references members(id) on delete cascade,
  candidate_id  uuid not null references candidates(id) on delete cascade,
  position_id   int references positions(id) on delete set null,
  created_at    timestamptz not null default now(),
  constraint uq_one_vote_per_member_election unique (election_id, member_id)
);
create index if not exists idx_votes_candidate on votes(candidate_id);
create index if not exists idx_votes_election on votes(election_id);

-- ─── vote receipts ──────────────────────────────────────────────────────────
create table if not exists vote_receipts (
  id            uuid primary key default gen_random_uuid(),
  election_id   uuid not null references elections(id) on delete cascade,
  member_id     uuid not null references members(id) on delete cascade,
  receipt_code  text not null unique,             -- TNR-2026-XXXX
  created_at    timestamptz not null default now()
);

-- ─── result settings (per election) ─────────────────────────────────────────
create table if not exists result_settings (
  election_id            uuid primary key references elections(id) on delete cascade,
  hide_results_during    boolean not null default true,   -- hide candidate counts while voting
  show_participation_only boolean not null default true,  -- show only participation live
  show_full_after_end    boolean not null default true,
  admin_live_preview     boolean not null default true,   -- admins may preview live results
  result_mode            text not null default 'after_close', -- full|percent|leading|hidden|after_close
  updated_at             timestamptz not null default now()
);

-- ─── committee vote entries (Super Admin only) ──────────────────────────────
create table if not exists committee_vote_entries (
  id            uuid primary key default gen_random_uuid(),
  election_id   uuid not null references elections(id) on delete cascade,
  member_id     uuid not null references members(id) on delete cascade,
  candidate_id  uuid not null references candidates(id) on delete cascade,
  position_id   int,
  entered_by    text not null,
  created_at    timestamptz not null default now(),
  constraint uq_committee_once unique (election_id, member_id)
);

-- ─── election committee (public homepage section) ───────────────────────────
create table if not exists committee_members (
  id          uuid primary key default gen_random_uuid(),
  full_name   text not null,
  role        text,
  photo_url   text,
  phone       text,
  email       text,
  bio         text,
  sort_order  int  not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ─── audit logs ─────────────────────────────────────────────────────────────
create table if not exists audit_logs (
  id           uuid primary key default gen_random_uuid(),
  action       text not null,     -- MEMBER_ADDED, MEMBER_APPROVED, VOTER_LIST_LOCKED, OTP_SENT, OTP_VERIFIED, VOTE_SUBMITTED, DUPLICATE_VOTE_ATTEMPT, RESULT_PUBLISHED, ...
  actor        text,              -- admin username or 'member' or 'system'
  details      text,
  election_id  uuid,
  ip_address   text,
  created_at   timestamptz not null default now()
);
create index if not exists idx_audit_action on audit_logs(action);
create index if not exists idx_audit_created on audit_logs(created_at desc);

-- ============================================================================
--  Row Level Security
--  All access goes through server-side API routes using the SERVICE ROLE key,
--  which bypasses RLS. We still enable RLS and add NO public policies so the
--  anon key cannot read/write these tables directly.
-- ============================================================================
alter table organizations       enable row level security;
alter table unions              enable row level security;
alter table admin_users         enable row level security;
alter table members             enable row level security;
alter table elections           enable row level security;
alter table positions           enable row level security;
alter table candidates          enable row level security;
alter table locked_voter_list   enable row level security;
alter table otp_verifications   enable row level security;
alter table votes               enable row level security;
alter table vote_receipts       enable row level security;
alter table result_settings     enable row level security;
alter table audit_logs          enable row level security;
alter table committee_members   enable row level security;
alter table committee_vote_entries enable row level security;

