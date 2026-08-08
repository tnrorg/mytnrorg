import { supabaseAdmin } from './supabaseServer';
import { cloudinaryClient, cloudinaryEnabled, CLOUDINARY_ROOT } from './cloudinary';

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'tnr-media';

/**
 * Upload a base64 data URL and return a public URL.
 *
 * Signature is unchanged from the Supabase-only version, so every existing
 * caller keeps working. Behaviour:
 *
 *   - Not a data: URL  → returned as-is. This is what keeps already-stored
 *                        Supabase URLs intact when a record is edited.
 *   - Cloudinary set   → uploaded to Cloudinary (images, video, PDFs, docs).
 *   - Otherwise        → falls back to the original Supabase Storage path.
 *
 * `resource_type: 'auto'` lets Cloudinary decide image / video / raw, so PDFs
 * and .docx land as `raw` and mp4 as `video` without any caller changes.
 */
export async function uploadDataUrl(dataUrl, folder = 'candidates') {
  if (!dataUrl || !dataUrl.startsWith('data:')) return dataUrl || null;

  const m = dataUrl.match(/^data:(.+?);base64,(.*)$/);
  if (!m) return null;

  const contentType = m[1];
  const base64 = m[2];

  if (cloudinaryEnabled()) {
    return uploadToCloudinary({ dataUrl, contentType, folder });
  }
  return uploadToSupabase({ base64, contentType, folder });
}

// ─── Cloudinary ────────────────────────────────────────────────────────────

async function uploadToCloudinary({ dataUrl, contentType, folder }) {
  const cld = cloudinaryClient();

  // Buffer size check — Cloudinary's non-chunked upload caps at 100 MB, and
  // Vercel caps request bodies well below that anyway. Fail loudly rather than
  // letting the platform return an opaque 413.
  const approxBytes = Math.floor((dataUrl.length - dataUrl.indexOf(',') - 1) * 0.75);
  if (approxBytes > 90 * 1024 * 1024) {
    throw new Error('File too large for direct upload. Use the signed browser upload instead.');
  }

  try {
    const result = await cld.uploader.upload(dataUrl, {
      folder: `${CLOUDINARY_ROOT}/${folder}`,
      resource_type: 'auto',
      unique_filename: true,
      overwrite: false,
      // Strip EXIF/location data from member and candidate photos.
      invalidate: true,
    });
    return result.secure_url;
  } catch (e) {
    throw new Error('Cloudinary upload failed: ' + (e?.message || String(e)));
  }
}

// ─── Supabase Storage (legacy fallback) ────────────────────────────────────

async function uploadToSupabase({ base64, contentType, folder }) {
  const buffer = Buffer.from(base64, 'base64');
  const ext = (contentType.split('/')[1] || 'png').replace('jpeg', 'jpg');
  const name = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const sb = supabaseAdmin();
  const { error } = await sb.storage
    .from(BUCKET)
    .upload(name, buffer, { contentType, upsert: true });
  if (error) throw new Error('Upload failed: ' + error.message);

  const { data } = sb.storage.from(BUCKET).getPublicUrl(name);
  return data.publicUrl;
}

// ─── Delivery helpers ──────────────────────────────────────────────────────

/**
 * Add automatic format + quality to a Cloudinary image URL.
 * Non-Cloudinary URLs (the existing Supabase ones) pass through untouched, so
 * this is safe to call on any stored URL.
 */
export function optimized(url, transform = 'f_auto,q_auto') {
  if (!url || typeof url !== 'string') return url;
  if (!url.includes('res.cloudinary.com')) return url;
  if (!url.includes('/image/upload/')) return url; // don't touch raw/video
  if (/\/upload\/[a-z]{1,3}_/.test(url)) return url; // already transformed
  return url.replace('/image/upload/', `/image/upload/${transform}/`);
}

/** Thumbnail variant — face-aware square crop. Safe on non-Cloudinary URLs. */
export function thumb(url, size = 200) {
  return optimized(url, `c_fill,g_face,w_${size},h_${size},f_auto,q_auto`);
}
