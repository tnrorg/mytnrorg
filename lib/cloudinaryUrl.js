/* Client-safe Cloudinary URL building — pure string work, no SDK, no keys.
 *
 * lib/storage.js already has `optimized()`, but that module imports the
 * Cloudinary client and the service-role Supabase client, so it cannot be
 * pulled into a component that runs in the browser. This is the same idea with
 * nothing behind it.
 *
 * Every function here is a no-op on a URL it does not recognise, so Supabase
 * Storage URLs and the /public files that predate the Cloudinary migration
 * pass through untouched.
 */

const isCloudinaryImage = (url) =>
  typeof url === 'string' &&
  url.includes('res.cloudinary.com') &&
  url.includes('/image/upload/') &&
  // Already carries a transformation — leave it alone rather than stacking a
  // second one, which changes the meaning of the first.
  !/\/upload\/[a-z]{1,3}_/.test(url);

/** Insert a transformation. Returns the URL unchanged if it is not Cloudinary. */
export function cld(url, transform = 'f_auto,q_auto') {
  if (!isCloudinaryImage(url)) return url;
  return url.replace('/image/upload/', `/image/upload/${transform}/`);
}

/* Widths offered to the browser.
 *
 * A phone was being sent the full-size upload — often 2000px+ of JPEG for a
 * 390px screen. `f_auto` alone fixes the format but not the pixel count, and
 * the pixel count is the larger cost by far.
 *
 * `q_auto` lets Cloudinary pick quality per image rather than applying one
 * number to a portrait and a landscape alike. `c_limit` never enlarges, so a
 * small original is not upscaled into a bigger file than it started as.
 */
const WIDTHS = [640, 828, 1080, 1400, 1920, 2560];

/** A srcSet across the standard widths. Empty string when not applicable. */
export function cldSrcSet(url, widths = WIDTHS) {
  if (!isCloudinaryImage(url)) return undefined;
  return widths
    .map(w => `${cld(url, `c_limit,w_${w},f_auto,q_auto`)} ${w}w`)
    .join(', ');
}

/** A sensible default src to pair with the srcSet, for browsers that ignore it. */
export function cldSrc(url, width = 1400) {
  return cld(url, `c_limit,w_${width},f_auto,q_auto`);
}

/**
 * A tiny, heavily blurred version of the same image.
 * Used as a CSS background under the real photo so the hero is never a blank
 * rectangle while the full image arrives — it costs about a kilobyte.
 */
export function cldBlur(url) {
  if (!isCloudinaryImage(url)) return undefined;
  return cld(url, 'c_limit,w_32,e_blur:400,f_auto,q_auto');
}
