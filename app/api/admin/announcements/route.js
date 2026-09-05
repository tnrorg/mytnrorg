import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAdmin } from '@/lib/guard';
import { logAudit, clientIp } from '@/lib/audit';
import { ok, fail, readJson } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const MAX_TEXT = 160;

/** Reject anything that is not a same-site path or an http(s) URL. */
function cleanHref(v) {
  const s = String(v || '').trim();
  if (!s) return null;
  if (s.startsWith('/')) return s;
  if (/^https?:\/\//i.test(s)) return s;
  return null;   // javascript:, data:, mailto: and typos all end up here
}

export async function GET(req) {
  const { res } = await requireAdmin(req); if (res) return res;
  const { data, error } = await supabaseAdmin()
    .from('announcements').select('*').order('sort_order').order('created_at');
  if (error) return fail('READ_FAILED', 500, {
    message: error.message,
    hint: 'Run supabase/migration_announcements.sql',
  });
  return ok({ items: data || [] });
}

export async function POST(req) {
  const { admin, res } = await requireAdmin(req); if (res) return res;
  const b = await readJson(req);
  const text = String(b.text || '').trim();

  if (!text) return fail('INVALID', 400, { message: 'Announcement text is required.' });
  if (text.length > MAX_TEXT)
    return fail('TOO_LONG', 400, { message: `Keep it under ${MAX_TEXT} characters — it has to read while scrolling.` });

  const { data, error } = await supabaseAdmin().from('announcements').insert({
    text,
    href: cleanHref(b.href),
    active: b.active !== false,
    sort_order: Number(b.sort_order) || 0,
    starts_at: b.starts_at || null,
    ends_at: b.ends_at || null,
  }).select().single();

  if (error) return fail('CREATE_FAILED', 500, { message: error.message });
  await logAudit({ action: 'ANNOUNCEMENT_CREATED', actor: admin.username, details: text, ip: clientIp(req) });
  return ok({ item: data });
}
