import qrcode from 'qrcode-generator';

/* QR rendering, done on our own server.
 *
 * The project already has components/member/QrCode.js, which builds an <img>
 * pointing at api.qrserver.com with the payload in the query string. That is
 * a reasonable trade for a public verification link — the URL is public
 * anyway.
 *
 * It would be a straightforward vulnerability here. A TOTP enrolment URI
 * contains the shared secret in full; sending it to a third-party image
 * service hands that service, its logs, and anyone between, the ability to
 * generate valid codes forever. Second factors do not survive being emailed to
 * strangers.
 *
 * So this renders locally. `qrcode-generator` has no dependencies of its own —
 * the payload never leaves the process.
 */
export function qrSvg(text, { size = 200, margin = 4, dark = '#0B1F17', light = '#FFFFFF' } = {}) {
  // Type 0 auto-sizes to the data. Error correction 'M' (~15%) is what
  // authenticator apps expect and tolerates a phone camera at an angle.
  const qr = qrcode(0, 'M');
  qr.addData(String(text));
  qr.make();

  const count = qr.getModuleCount();
  const total = count + margin * 2;

  // One <path> for every dark module rather than thousands of <rect>s — the
  // markup is inlined into an HTML response, so its size is worth minding.
  let d = '';
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (qr.isDark(r, c)) d += `M${c + margin} ${r + margin}h1v1h-1z`;
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" ` +
    `viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges" role="img" ` +
    `aria-label="Two-factor authentication setup QR code">` +
    `<rect width="${total}" height="${total}" fill="${light}"/>` +
    `<path d="${d}" fill="${dark}"/></svg>`;
}

/** The same SVG as a data URI, for use directly in an <img src>. */
export function qrDataUri(text, opts) {
  return `data:image/svg+xml;base64,${Buffer.from(qrSvg(text, opts)).toString('base64')}`;
}
