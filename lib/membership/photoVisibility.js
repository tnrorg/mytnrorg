/**
 * Strip a member's photograph from anything the public can read.
 *
 * This runs on the SERVER, not in the component. Sending photo_url and hiding
 * it in the browser would leave the address sitting in the API response for
 * anyone who opens the network tab — and the whole point of the setting is
 * that a woman who has asked for her photo not to be published can rely on it
 * not being published.
 *
 * Cloudinary and the tnr-media bucket are both world-readable by URL, so the
 * URL IS the photo. Withholding it is the only control there is.
 */
export function withholdPhoto(row) {
  if (!row) return row;
  if (row.photo_public === false) {
    const { photo_url, photo_public, ...rest } = row;
    // photo_url is dropped entirely rather than set to null, so it never
    // appears in the payload at all.
    return { ...rest, photo_hidden: true };
  }
  const { photo_public, ...rest } = row;
  return rest;
}

/** Same, for a list. */
export const withholdPhotos = (rows) => (rows || []).map(withholdPhoto);

/** Columns a query must select for withholdPhoto to work. */
export const PHOTO_VISIBILITY_COLUMNS = 'photo_public';
