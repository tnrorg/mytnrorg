/**
 * Upload any newly picked gallery photos and return the final URL list.
 *
 * Shared by projects and institutions. `gallery` holds photos already stored;
 * `gallery_add` holds new files as data URLs. A failed upload throws rather
 * than being skipped — a photo that silently vanishes looks exactly like one
 * that was never picked.
 */
export async function resolveGallery(b, uploadDataUrl, folder) {
  const kept = Array.isArray(b.gallery)
    ? b.gallery.map(u => String(u || '').trim()).filter(Boolean)
    : [];
  const added = Array.isArray(b.gallery_add) ? b.gallery_add.filter(Boolean) : [];

  const uploaded = [];
  for (const dataUrl of added.slice(0, 30)) {
    uploaded.push(await uploadDataUrl(dataUrl, folder));
  }
  return [...new Set([...kept, ...uploaded])].slice(0, 30);
}

/** Sanitised URL list straight from a request body, for the non-upload path. */
export const cleanGallery = (v) => Array.isArray(v)
  ? v.map(u => String(u || '').trim()).filter(Boolean).slice(0, 30)
  : [];

/** Cover photo plus gallery, de-duplicated — the cover is often in both. */
export const allPhotos = (r) =>
  [...new Set([r?.image_url, ...(r?.gallery || [])].filter(Boolean))];
