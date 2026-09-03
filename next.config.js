/** @type {import('next').NextConfig} */

/* Security headers.
 *
 * The site previously sent none, so it had no clickjacking protection, no
 * HSTS, and a permissive referrer policy that leaked full URLs — including
 * /member/set-password?token=… — to any third-party host an outbound link
 * pointed at.
 *
 * No Content-Security-Policy yet: the app uses inline styles throughout and a
 * CSP added blind would either break the site or need 'unsafe-inline', which
 * buys almost nothing. Doing it properly needs a nonce pass and its own
 * testing round — recorded as a remaining recommendation rather than rushed.
 */
const securityHeaders = [
  // Clickjacking. frame-ancestors is the modern control; X-Frame-Options is
  // kept for older browsers that ignore it.
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'self'" },

  // Stop the browser guessing a type and executing an uploaded file as script.
  { key: 'X-Content-Type-Options', value: 'nosniff' },

  // Send only the origin cross-site. Password-reset and invitation tokens live
  // in query strings, and the default policy would hand them to any external
  // site a member clicks through to.
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },

  /* Permissions-Policy is NOT here — it is set per-path in headers() below.
   *
   * It has to be, because the meeting room needs camera and microphone and
   * the rest of the site must not have them. Setting it here as well would
   * put TWO Permissions-Policy headers on every response, and repeated
   * headers are concatenated by the browser rather than replaced — which
   * makes the effective policy something you have to derive instead of read.
   * One header, one source of truth. */

  // Two years, subdomains included. Safe: the site is HTTPS-only on Vercel.
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },

  { key: 'X-DNS-Prefetch-Control', value: 'on' },
];

const nextConfig = {
  reactStrictMode: true,

  // Vercel adds this by default; naming it explicitly keeps the server version
  // out of responses if the app is ever hosted elsewhere.
  poweredByHeader: false,

  /* Inline the CSS the first screen actually needs, and load the rest without
     blocking the render.
   *
   * The audit measured a 490ms render-blocking cost from two stylesheets that
   * load in sequence — the Tailwind bundle, then the font CSS — so nothing
   * paints for over a second while they resolve. Inlining what the first
   * screen uses removes both from the critical path, which moves FCP and
   * takes LCP with it.
   *
   * This is a Next EXPERIMENTAL flag and it is the one change here that could
   * cause a visual regression rather than just a slower page: critters decides
   * what counts as "critical", and it occasionally misjudges a rule that only
   * applies after hydration. If anything looks wrong after deploying, delete
   * this `experimental` block and redeploy — nothing else depends on it. */
  experimental: {
    optimizeCss: true,
  },

  images: {
    /* Was hostname: '**' — the optimiser would fetch and serve an image from
       ANY https host on request, which is a server-side request forgery
       primitive and lets a third party serve bytes from your domain. Narrowed
       to the hosts that actually store TNR media. */
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: 'www.mytnr.org' },
      { protocol: 'https', hostname: 'mytnrorg.vercel.app' },
    ],

    /* AVIF first, WebP second, original as the fallback.
       AVIF is typically 30-50% smaller than the JPEGs currently being served
       straight from Supabase Storage. */
    formats: ['image/avif', 'image/webp'],

    /* Supabase Storage sends Cache-Control: max-age=3600, so every returning
       visitor was re-downloading more than a megabyte of photographs after an
       hour — the "efficient cache lifetimes, est. savings 975 KiB" finding.

       Optimised images are addressed by a URL containing the source, width and
       quality, so the content at a given URL cannot change; caching it for a
       year is safe. Replacing a photo produces a different URL. */
    minimumCacheTTL: 31536000,   // one year

    /* Only the widths actually used. Each entry is a variant the optimiser may
       be asked to generate, and a shorter list means more cache hits. */
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
  },

  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },

      /* ── Camera and microphone ──────────────────────────────────────────
       *
       * THIS IS WHY THE MEETING ROOM COULD NOT PUBLISH AUDIO OR VIDEO.
       *
       * The site-wide policy used to be `camera=(), microphone=()`. An EMPTY
       * allowlist does not mean "no third parties" — it means NO ORIGINS AT
       * ALL, including this one. Chrome therefore refused every
       * getUserMedia() call on mytnr.org with NotAllowedError, so the LiveKit
       * room connected happily over WebSocket, the toolbar rendered, and the
       * camera and microphone buttons did nothing. The avatar stayed up
       * because there was never a track to render.
       *
       * That header was correct when it was written — nothing on the site
       * used these devices. The meeting module changed that fact and the
       * header was not revisited.
       *
       * Now: `(self)` on the two paths that hold the meeting room, and the
       * same closed policy everywhere else. A page that has no business
       * reaching for a camera still cannot, and no third-party frame can
       * anywhere — the grant is this origin only. */
      {
        source: '/member/meetings/:path*',
        headers: [{
          key: 'Permissions-Policy',
          value: 'camera=(self), microphone=(self), display-capture=(self), geolocation=(), payment=(), usb=()',
        }],
      },
      {
        // The public landing page, so a member can be told their browser has
        // blocked the devices before they are standing in a live meeting.
        source: '/virtual-hall',
        headers: [{
          key: 'Permissions-Policy',
          value: 'camera=(self), microphone=(self), display-capture=(self), geolocation=(), payment=(), usb=()',
        }],
      },
      {
        /* Everywhere else: still fully denied, as before.
         *
         * This has to be a NEGATIVE match rather than a blanket rule plus an
         * override. Two Permissions-Policy headers on one response are
         * combined by the browser and the MOST RESTRICTIVE value wins, so a
         * site-wide `camera=()` would silently defeat the `camera=(self)`
         * above and put the meeting room straight back where it was. The two
         * rules must not overlap. */
        source: '/((?!member/meetings|virtual-hall).*)',
        headers: [{
          key: 'Permissions-Policy',
          value: 'camera=(), microphone=(), display-capture=(), geolocation=(), payment=(), usb=()',
        }],
      },

      // Admin and member portals must never be cached by a shared proxy.
      {
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
      {
        source: '/admin/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
      {
        source: '/member/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
    ];
  },
};

module.exports = nextConfig;
