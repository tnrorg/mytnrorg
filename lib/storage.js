import { supabaseAdmin } from './supabaseServer';
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'tnr-media';

// Upload a base64 data URL (data:image/...;base64,....) and return a public URL.
export async function uploadDataUrl(dataUrl, folder = 'candidates') {
  if (!dataUrl || !dataUrl.startsWith('data:')) return dataUrl || null;
  const m = dataUrl.match(/^data:(.+?);base64,(.*)$/);
  if (!m) return null;
  const contentType = m[1];
  const buffer = Buffer.from(m[2], 'base64');
  const ext = (contentType.split('/')[1] || 'png').replace('jpeg', 'jpg');
  const name = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const sb = supabaseAdmin();
  const { error } = await sb.storage.from(BUCKET).upload(name, buffer, { contentType, upsert: true });
  if (error) throw new Error('Upload failed: ' + error.message);
  const { data } = sb.storage.from(BUCKET).getPublicUrl(name);
  return data.publicUrl;
}
