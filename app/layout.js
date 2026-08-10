import './globals.css';
import { Mulish } from 'next/font/google';
import BackToTop from '@/components/site/BackToTop';
import VisitTracker from '@/components/site/VisitTracker';
import SmoothScroll from '@/components/site/SmoothScroll';

const mulish = Mulish({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-mulish',
  weight: ['300', '400', '500', '600', '700', '800', '900'],
});

export const metadata = {
  metadataBase: new URL('https://www.mytnr.org'),
  title: 'Tehreek-e-Nojawanan Roundu — Digital Community Platform',
  description:
    'Official digital community platform of Tehreek-e-Nojawanan Roundu — membership, leadership, projects and elections for the youth of Roundu.',
  icons: { icon: '/tnr-logo.png' },
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
    <html lang="en" className={mulish.variable}>
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

        {/* Urdu script uses Noto Nastaliq (different alphabet, not the body font) */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        {/* The stylesheet is served from googleapis, but the font FILES it
            references come from gstatic — a second origin, and a second round
            of connection setup that would otherwise not begin until the CSS
            had downloaded and been parsed. */}
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400;600;700&display=swap" rel="stylesheet" />
        {/* maximum-scale=1 was blocking pinch-zoom, which fails WCAG 1.4.4:
            anyone who needs to magnify text could not. Nothing on the site
            depends on the viewport being unscalable. */}
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>
        {/* Keyboard and screen-reader users can jump past the navigation.
            Hidden until focused — see .tnr-skip-link in globals.css. */}
        <a href="#main" className="tnr-skip-link">Skip to main content</a>
        {children}
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
