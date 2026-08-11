-- ════════════════════════════════════════════════════════════════════════════
-- Passport photograph on Executive Committee applications
--
-- Safe to run more than once. One nullable column; no existing row changes.
--
-- Nullable on purpose. Applications already submitted have no photograph and
-- must stay valid — making this NOT NULL would either reject them or force a
-- placeholder that looks like a real answer.
-- ════════════════════════════════════════════════════════════════════════════

alter table cec_applications
  add column if not exists photo_url text;

comment on column cec_applications.photo_url is
  'Passport-style photograph supplied with the application. Cloudinary URL. Null for applications submitted before this field existed.';

-- ── verify ──────────────────────────────────────────────────────────────────
select
  count(*)                       as applications,
  count(photo_url)               as with_photo,
  count(*) - count(photo_url)    as without_photo
from cec_applications;
