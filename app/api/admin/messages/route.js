import { supabaseAdmin } from '@/lib/supabaseServer';
import { requireAdmin } from '@/lib/guard';
import { uploadDataUrl } from '@/lib/storage';
import { logAudit, clientIp } from '@/lib/audit';
import { ok, fail, readJson } from '@/lib/api';
import { MESSAGE_KEYS, MESSAGE_DEFAULTS, blankMessage } from '@/lib/leadershipMessages';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const HINT = 'Run supabase/migration_leadership_messages.sql in the Supabase SQL Editor.';
const TEXT_FIELDS = ['heading', 'name', 'designation', 'message'];

export async function GET(req) {
  const { res } = requireAdmin(req); if (res) return res;
  const { data, error } = await supabaseAdmin().from('leadership_messages').select('*').order('sort_order');
  if (error) return fail('READ_FAILED', 500, { message: error.message, hint: HINT });

  // Always hand back both rows, so a half-seeded table still gives the admin
  // two editable cards instead of one.
  const byKey = Object.fromEntries((data || []).map(r => [r.key, r]));
  return ok({ messages: MESSAGE_KEYS.map(k => ({ ...blankMessage(k), ...(byKey[k] || {}) })) });
}

export async function PATCH(req) {
  const { admin, res } = requireAdmin(req); if (res) return res;
  const b = await readJson(req);
  const key = String(b.key || '');
  if (!MESSAGE_KEYS.includes(key)) {
    return fail('INVALID', 400, { message: 'Unknown message. Expected founder or president.' });
  }

  const patch = { key, sort_order: MESSAGE_DEFAULTS[key].sort_order, updated_at: new Date().toISOString() };
  for (const f of TEXT_FIELDS) if (f in b) patch[f] = String(b[f] ?? '').trim();
  if ('published' in b) patch.published = !!b.published;

  // Uploads are reported, never swallowed: a silent failure here looks
  // identical to "the photo did not save" and wastes the admin's time.
  for (const [src, col, folder] of [
    ['photo_data', 'photo_url', 'messages'],
    ['signature_data', 'signature_url', 'messages'],
  ]) {
    if (b[src]) {
      try { patch[col] = await uploadDataUrl(b[src], folder); }
      catch (e) { return fail('UPLOAD_FAILED', 500, { message: `${col === 'photo_url' ? 'Photo' : 'Signature'} upload failed: ${e.message}` }); }
    } else if (col in b) {
      patch[col] = b[col] || null;   // explicit null clears it
    }
  }

  // Publishing an empty message would put a blank card on the home page.
  if (patch.published) {
    const text = 'message' in patch ? patch.message : null;
    if (text !== null && !text) {
      return fail('EMPTY_MESSAGE', 400, { message: 'Write the message before publishing it.' });
    }
  }

  const { data, error } = await supabaseAdmin().from('leadership_messages')
    .upsert(patch, { onConflict: 'key' }).select().maybeSingle();
  if (error) return fail('SAVE_FAILED', 500, { message: error.message, hint: HINT });

  await logAudit({
    action: 'HOME_MESSAGE_UPDATED', actor: admin.username,
    details: `${MESSAGE_DEFAULTS[key].heading}${'published' in b ? (b.published ? ' — published' : ' — hidden') : ''}`,
    ip: clientIp(req),
  });
  return ok({ message_row: data, message: 'Saved.' });
}
