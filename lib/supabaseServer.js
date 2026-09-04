import { createClient } from '@supabase/supabase-js';

// Service-role client — SERVER ONLY. Bypasses RLS. Never import in client code.
let _admin;
export function supabaseAdmin() {
  if (_admin) return _admin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase env not configured (URL / SERVICE_ROLE_KEY).');
  _admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return _admin;
}

/* A short-lived link to a private recording.
 *
 * ONE HOUR. Long enough to watch a committee session, short enough that a URL
 * copied out of a browser or forwarded in a message stops working the same
 * afternoon. Signed on demand, never stored.
 *
 * Falls back to the raw url rather than failing: a recording from before the
 * bucket existed, or from another provider, should still open.
 */
export async function signedRecordingUrl(fileUrl, expiresIn = 3600) {
  const bucket = process.env.LIVEKIT_S3_BUCKET;
  if (!fileUrl || !bucket) return fileUrl || null;

  const m = String(fileUrl).match(new RegExp(`/${bucket}/(.+)$`));
  if (!m) return fileUrl;
  const path = decodeURIComponent(m[1].split('?')[0]);

  try {
    const { data, error } = await supabaseAdmin()
      .storage.from(bucket).createSignedUrl(path, expiresIn);
    if (error || !data?.signedUrl) return fileUrl;
    return data.signedUrl;
  } catch {
    return fileUrl;
  }
}
