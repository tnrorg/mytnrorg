'use client';

/* Downscale an image in the browser before it is uploaded.
 *
 * Why this exists: photos straight off a phone are 3–8 MB. Base64 adds another
 * third on top, and the hosting platform rejects request bodies over about
 * 4.5 MB — so a large hero photo failed to save with an error that looked like
 * a bug in the form. Shrinking first fixes that, and a 4000px-wide file was
 * never going to be a good idea on the home page anyway: visitors on mobile
 * data would have paid for every one of those pixels.
 *
 * Returns a JPEG data URL. Transparency is lost, which is correct for photos;
 * pass `keepPng` for logos and signatures where it matters.
 */
export function resizeImage(file, { maxWidth = 1920, maxHeight = 1920, quality = 0.82, keepPng = false } = {}) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('No file selected.'));
    if (!/^image\//.test(file.type)) return reject(new Error('That file is not an image.'));

    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxWidth / img.width, maxHeight / img.height);
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));

      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Could not process the image in this browser.'));

      // White behind the image: without it a transparent PNG flattens to black
      // when written out as JPEG.
      if (!keepPng) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); }
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, w, h);

      const out = keepPng
        ? canvas.toDataURL('image/png')
        : canvas.toDataURL('image/jpeg', quality);
      resolve({ dataUrl: out, width: w, height: h, bytes: Math.round((out.length - out.indexOf(',') - 1) * 0.75) });
    };

    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That image could not be read.')); };
    img.src = url;
  });
}

/** Human-readable size, for telling the admin what was uploaded. */
export const kb = (bytes) => bytes >= 1024 * 1024
  ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
  : `${Math.max(1, Math.round(bytes / 1024))} KB`;
