-- Adds the public result-visibility mode. Run in Supabase → SQL Editor.
alter table result_settings add column if not exists result_mode text not null default 'after_close';
-- modes: 'full' | 'percent' | 'leading' | 'hidden' | 'after_close'
