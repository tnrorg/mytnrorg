import './globals.css';
import { Mulish } from 'next/font/google';
import BackToTop from '@/components/site/BackToTop';
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
        {/* Urdu script uses Noto Nastaliq (different alphabet, not the body font) */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400;600;700&display=swap" rel="stylesheet" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </head>
      <body>
        {/* Keyboard and screen-reader users can jump past the navigation.
            Hidden until focused — see .tnr-skip-link in globals.css. */}
        <a href="#main" className="tnr-skip-link">Skip to main content</a>
        {children}
        {/* One back-to-top control for the whole site — public pages, the
            member portal and the admin panel all get it. */}
        <BackToTop />
        {/* Eases mouse-wheel scrolling. Renders nothing; safe to delete. */}
        <SmoothScroll />
      </body>
    </html>
  );
}
