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

  // Nothing here needs these.
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },

  // Two years, subdomains included. Safe: the site is HTTPS-only on Vercel.
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },

  { key: 'X-DNS-Prefetch-Control', value: 'on' },
];

const nextConfig = {
  reactStrictMode: true,

  // Vercel adds this by default; naming it explicitly keeps the server version
  // out of responses if the app is ever hosted elsewhere.
  poweredByHeader: false,

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
