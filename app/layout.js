import './globals.css';
import { Mulish, Noto_Nastaliq_Urdu } from 'next/font/google';
import BackToTop from '@/components/site/BackToTop';
import VisitTracker from '@/components/site/VisitTracker';
import SmoothScroll from '@/components/site/SmoothScroll';
import MotionProvider from '@/components/site/MotionProvider';

const mulish = Mulish({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-mulish',
  weight: ['300', '400', '500', '600', '700', '800', '900'],
});

/* Urdu, self-hosted.
 *
 * This was a <link> to fonts.googleapis.com. A stylesheet in <head> is
 * render-blocking, so every page — including the home page, which has no Urdu
 * on it at all — waited on a third-party round trip before painting anything.
 * It measured 750ms for 1.4 KB: almost entirely connection setup.
 *
 * next/font serves the CSS from our own origin at build time, so there is no
 * third-party request and nothing to block on.
 *
 * preload: false is deliberate. The font is used on /about, /dashboard,
 * /results and /vote, not on the pages most visitors land on. Preloading would
 * fetch a large Nastaliq file on every page in case it were needed; without
 * it, the file is fetched only when something actually applies the .urdu
 * class, which is the honest description of when it is needed.
 */
const nastaliq = Noto_Nastaliq_Urdu({
  subsets: ['arabic'],
  display: 'swap',
  variable: '--font-nastaliq',
  weight: ['400', '600', '700'],
  preload: false,
});

export const metadata = {
  metadataBase: new URL('https://www.mytnr.org'),
  title: 'Tehreek-e-Nojawanan Roundu — Digital Community Platform',
  description:
    'Official digital community platform of Tehreek-e-Nojawanan Roundu — membership, leadership, projects and elections for the youth of Roundu.',
  icons: { icon: '/tnr-logo.png' },
  /* Google Search Console ownership.
   *
   * Next emits this as <meta name="google-site-verification"> in <head> on
   * every page. Declared here rather than hand-written into the markup so a
   * future edit to the layout cannot quietly drop it — losing the tag
   * un-verifies the property and Search Console stops reporting.
   *
   * Not a secret: it is designed to be readable by anyone who views the page
   * source. It proves control of this site, and grants nothing on its own. */
  verification: {
    google: 'a3DEZCOZ9cGeayKFdIv-upXWRJOqijt0_6CLThDjvUU',
  },
  openGraph: {
    title: 'Tehreek-e-Nojawanan Roundu — Digital Community Platform',
    description:
      'Official digital community platform of Tehreek-e-Nojawanan Roundu — membership, leadership, projects and elections for the youth of Roundu.',
    url: 'https://www.mytnr.org',
    siteName: 'Tehreek-e-Nojawanan Roundu',
    images: [{ url: '/tnr-logo.png', width: 1200, height: 630, alt: 'Tehreek-e-Nojawanan Roundu' }],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tehreek-e-Nojawanan Roundu — Digital Community Platform',
    description:
      'Official digital community platform of Tehreek-e-Nojawanan Roundu — membership, leadership, projects and elections for the youth of Roundu.',
    images: ['/tnr-logo.png'],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${mulish.variable} ${nastaliq.variable}`}>
      <head>
        {/* Every photograph on the site is served from Cloudinary, including
            the hero — the largest element on the home page. Opening that
            connection costs a DNS lookup, a TCP handshake and a TLS
            negotiation, and without this hint none of it starts until the
            browser has parsed far enough to find the <img>. Preconnect gets
            it under way while the HTML is still arriving.

            crossOrigin is required: images are fetched anonymously, and a
            preconnect opened in the wrong mode is not reused — the browser
            simply opens a second connection and the hint achieves nothing. */}
        <link rel="preconnect" href="https://res.cloudinary.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://res.cloudinary.com" />

        {/* The Google Fonts <link> and its two preconnects used to sit here.
            Both fonts are self-hosted by next/font now, so there is no
            third-party font origin left to connect to — and a preconnect to a
            host nothing requests is itself a small waste. */}
        {/* maximum-scale=1 was blocking pinch-zoom, which fails WCAG 1.4.4:
            anyone who needs to magnify text could not. Nothing on the site
            depends on the viewport being unscalable. */}
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {/* WITHOUT JAVASCRIPT, EVERY REVEALED SECTION WOULD BE INVISIBLE.
            Framer Motion server-renders the `hidden` variant, so each Reveal
            arrives in the HTML carrying an inline `opacity:0`. With scripts
            blocked or broken nothing ever sets it back to 1, and most of the
            home page is blank — a silent, total content loss for anyone on a
            locked-down browser, a corporate proxy that strips bundles, or a
            failed deploy. An inline style can only be beaten by !important,
            which is why this is a stylesheet rule and not a class swap. */}
        <noscript>
          <style>{`.tnr-reveal{opacity:1!important;transform:none!important}`}</style>
        </noscript>
      </head>
      <body>
        {/* Keyboard and screen-reader users can jump past the navigation.
            Hidden until focused — see .tnr-skip-link in globals.css. */}
        <a href="#main" className="tnr-skip-link">Skip to main content</a>
        {/* Makes Framer Motion honour "reduce motion". The CSS block in
            globals.css cannot: Framer animates inline styles from JS, not CSS
            transitions. See components/site/MotionProvider.js. */}
        <MotionProvider>{children}</MotionProvider>
        {/* One back-to-top control for the whole site — public pages, the
            member portal and the admin panel all get it. */}
        <BackToTop />
        {/* Counts one visit per browser session. Renders nothing. */}
        <VisitTracker />
        {/* Eases mouse-wheel scrolling. Renders nothing; safe to delete. */}
        <SmoothScroll />
      </body>
    </html>
  );
}
