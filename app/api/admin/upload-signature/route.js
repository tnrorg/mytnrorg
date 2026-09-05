import { ok, fail, readJson } from '@/lib/api';
import { requireAdmin } from '@/lib/guard';
import { cloudinaryClient, cloudinaryEnabled, CLOUDINARY_ROOT } from '@/lib/cloudinary';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Issue a short-lived signature so the browser can upload straight to
 * Cloudinary, bypassing our server entirely.
 *
 * Needed for video and large documents: Vercel caps serverless request bodies
 * at ~4.5 MB, and base64 inflates a file by ~33%, so anything over roughly
 * 3 MB cannot go through the normal uploadDataUrl() path.
 *
 * The API secret never leaves the server — only the computed signature does.
 */
const ALLOWED_FOLDERS = new Set([
  'candidates',
  'members',
  'leadership',
  'projects',
  'institutions',
  'hero',
  'committee',
  'messages',
  'symbols',
  'org',
  'documents',
  'cv',
  'certificates',
  'gallery',
  'video',
]);

export async function POST(req) {
  const { res } = await requireAdmin(req);
  if (res) return res;

  if (!cloudinaryEnabled()) {
    return fail('CLOUDINARY_NOT_CONFIGURED', 500, {
      message: 'Cloudinary environment variables are not set on this deployment.',
    });
  }

  const body = await readJson(req);
  const folder = String(body.folder || 'documents').replace(/[^a-z0-9_-]/gi, '');

  if (!ALLOWED_FOLDERS.has(folder)) {
    return fail('INVALID_FOLDER', 400, {
      message: `folder must be one of: ${[...ALLOWED_FOLDERS].join(', ')}`,
    });
  }

  try {
    const cld = cloudinaryClient();
    const timestamp = Math.round(Date.now() / 1000);

    // Every param signed here must be sent by the client, byte for byte.
    const paramsToSign = {
      timestamp,
      folder: `${CLOUDINARY_ROOT}/${folder}`,
    };

    const signature = cld.utils.api_sign_request(
      paramsToSign,
      process.env.CLOUDINARY_API_SECRET
    );

    return ok({
      signature,
      timestamp,
      folder: paramsToSign.folder,
      apiKey: process.env.CLOUDINARY_API_KEY,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      uploadUrl: `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/auto/upload`,
    });
  } catch (e) {
    return fail('SIGNATURE_FAILED', 500, { message: e?.message || 'Could not sign upload.' });
  }
}
