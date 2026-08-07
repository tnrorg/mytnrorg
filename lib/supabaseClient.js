import { createClient } from '@supabase/supabase-js';
// Browser (anon) client. RLS blocks direct table access — used only for Storage public URLs if needed.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);
