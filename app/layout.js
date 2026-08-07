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
  title: 'Tehreek-e-Nojawanan Roundu — Election Portal',
  description: 'Official online election portal of Tehreek-e-Nojawanan Roundu. Your Vote, Your Voice.',
  icons: { icon: '/tnr-logo.png' },
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
