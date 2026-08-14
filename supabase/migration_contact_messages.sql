-- ════════════════════════════════════════════════════════════════════════════
-- Contact, Feedback, Complaints and Technical Support messages
--
-- Safe to run more than once. Creates one table; changes nothing existing.
--
-- Messages are STORED, not just emailed. Email is a notification, not the
-- record: an SMTP failure, a full mailbox or the Gmail daily quota running out
-- would otherwise lose a complaint silently, and nobody would know it had been
-- sent. The row is written first and the email attempted afterwards.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists contact_messages (
  id            uuid primary key default gen_random_uuid(),

  -- Which of the four forms it came from. Stored rather than inferred from the
  -- page, so a complaint stays a complaint in the admin inbox and in any
  -- future report, regardless of how the pages are later reorganised.
  kind          text not null default 'general'
                  check (kind in ('general', 'feedback', 'complaint', 'support')),

  -- ── Sender ────────────────────────────────────────────────────────────────
  name          text not null default '',
  email         text not null default '',
  mobile        text not null default '',
  -- Optional. A member who gives their ID can be looked up; a member of the
  -- public leaves it blank and is still heard.
  membership_id text not null default '',

  subject       text not null default '',
  message       text not null default '',

  -- ── Handling ──────────────────────────────────────────────────────────────
  status        text not null default 'new'
                  check (status in ('new', 'read', 'resolved', 'spam')),
  admin_notes   text not null default '',
  handled_by    text,
  handled_at    timestamptz,

  -- Kept for abuse investigation only. Not shown in the inbox listing.
  ip            text,
  user_agent    text,

  created_at    timestamptz not null default now()
);

create index if not exists idx_contact_messages_created on contact_messages(created_at desc);
create index if not exists idx_contact_messages_status  on contact_messages(status);
create index if not exists idx_contact_messages_kind    on contact_messages(kind);

-- Denies everything to anon and authenticated. These messages can contain
-- complaints about named people; only the server-side service-role key reads
-- them, exactly as with membership records.
alter table contact_messages enable row level security;

-- ── prerequisite: rate-limit counters ───────────────────────────────────────
-- Repeated from migration_login_protection.sql. The contact form is public and
-- unauthenticated, and lib/loginGuard.js fails OPEN when this table is absent
-- — so without it the form would accept unlimited submissions from one source.
create table if not exists login_attempts (
  scope        text not null,
  identifier   text not null,
  fails        int  not null default 0,
  first_fail   timestamptz not null default now(),
  locked_until timestamptz,
  updated_at   timestamptz not null default now(),
  primary key (scope, identifier)
);
create index if not exists idx_login_attempts_locked on login_attempts(locked_until);
alter table login_attempts enable row level security;

-- ── verify ──────────────────────────────────────────────────────────────────
select kind, status, count(*)
  from contact_messages
 group by kind, status
 order by kind, status;
