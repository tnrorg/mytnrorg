import { supabaseAdmin } from './supabaseServer';

/**
 * Storage for identity documents (CNIC front/back).
 *
 * Deliberately NOT the Cloudinary path used by lib/storage.js. Those assets are
 * publicly readable by URL, which is correct for a candidate's portrait and
 * badly wrong for a national identity card — a leaked link would expose the
 * CNIC number, date of birth, address and photograph with no login required.
 *
 * Files go into a private Supabase bucket. Nothing here ever returns a durable
 * public URL; admins get a short-lived signed link, minted per view.
 */
const BUCKET = process.env.SUPABASE_PRIVATE_BUCKET || 'tnr-private';

/** How long an admin's view link stays valid. Long enough to look, not to share. */
export const SIGNED_URL_TTL = 300; // 5 minutes

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
const MAX_BYTES = 8 * 1024 * 1024;

/**
 * Store a base64 data URL privately.
 * Returns the storage PATH, not a URL — the path is what goes in the database.
 */
export async function uploadPrivateDataUrl(dataUrl, folder = 'cnic') {
  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) return null;

  const m = dataUrl.match(/^data:(.+?);base64,(.*)$/);
  if (!m) throw new Error('Unrecognised file format.');

  const contentType = m[1];
  if (!ALLOWED.has(contentType))
    throw new Error('Please upload a JPG, PNG, WEBP or PDF.');

  const buffer = Buffer.from(m[2], 'base64');
  if (buffer.length > MAX_BYTES)
    throw new Error(`File is too large (${(buffer.length / 1048576).toFixed(1)} MB). Maximum is 8 MB.`);

  const ext = contentType === 'application/pdf'
    ? 'pdf'
    : (contentType.split('/')[1] || 'jpg').replace('jpeg', 'jpg');

  // Random name, not derived from the applicant — the path itself should not
  // reveal whose document it is if it ever appears in a log.
  const name = `${folder}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

  const { error } = await supabaseAdmin().storage
    .from(BUCKET)
    .upload(name, buffer, { contentType, upsert: false });

  if (error) throw new Error('Upload failed: ' + error.message);
  return name;
}

/** Short-lived link for an admin to view one document. Null if unavailable. */
export async function signPrivatePath(path, ttl = SIGNED_URL_TTL) {
  if (!path) return null;
  try {
    const { data, error } = await supabaseAdmin().storage
      .from(BUCKET)
      .createSignedUrl(path, ttl);
    if (error) return null;
    return data?.signedUrl || null;
  } catch {
    return null;
  }
}

/** Remove a stored document, e.g. when an application is deleted. */
export async function deletePrivatePath(path) {
  if (!path) return;
  try { await supabaseAdmin().storage.from(BUCKET).remove([path]); } catch { /* best effort */ }
}
