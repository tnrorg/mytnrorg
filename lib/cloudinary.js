import { v2 as cloudinary } from 'cloudinary';

// Cloudinary client — SERVER ONLY. Never import in client components.
// Credentials come from Cloudinary Console → Settings → API Keys.
let _configured = false;

export function cloudinaryClient() {
  if (_configured) return cloudinary;

  const cloud_name = process.env.CLOUDINARY_CLOUD_NAME;
  const api_key = process.env.CLOUDINARY_API_KEY;
  const api_secret = process.env.CLOUDINARY_API_SECRET;

  if (!cloud_name || !api_key || !api_secret) {
    throw new Error(
      'Cloudinary env not configured (CLOUDINARY_CLOUD_NAME / API_KEY / API_SECRET).'
    );
  }

  cloudinary.config({ cloud_name, api_key, api_secret, secure: true });
  _configured = true;
  return cloudinary;
}

/** True when Cloudinary credentials are present. Lets code fall back to Supabase. */
export function cloudinaryEnabled() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
  );
}

/** Root folder inside Cloudinary so TNR assets stay grouped. */
export const CLOUDINARY_ROOT = process.env.CLOUDINARY_FOLDER || 'tnr';
