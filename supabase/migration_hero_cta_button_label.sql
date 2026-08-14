-- ════════════════════════════════════════════════════════════════════════════
-- Separate label for the hero's call-to-action BUTTON
--
-- Safe to run more than once. One column with a default; no row changes.
--
-- WHY
-- The hero's two links now sit inside a menu behind one button. The button was
-- borrowing cta1_label, which meant the button and the first menu entry could
-- never read differently — "Join/Login TNR" on the button forced "Join/Login
-- TNR" as the first choice inside it, where it should say "Join TNR".
--
-- Empty by default, and the code falls back to cta1_label when it is empty, so
-- every existing slide behaves exactly as it does today until an admin decides
-- otherwise.
-- ════════════════════════════════════════════════════════════════════════════

alter table hero_slides
  add column if not exists cta_button_label text not null default '';

comment on column hero_slides.cta_button_label is
  'Text on the hero button that opens the menu, e.g. "Join/Login TNR". When empty the button falls back to cta1_label. The menu entries always use cta1_label and cta2_label.';

-- ── verify ──────────────────────────────────────────────────────────────────
select id, title,
       cta_button_label as button,
       cta1_label       as menu_item_1,
       cta2_label       as menu_item_2
  from hero_slides
 order by sort_order;
