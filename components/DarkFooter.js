'use client';
// Dark footer used by /results and /dashboard.
// Lives here (not in app/page.js) because Next.js App Router page files
// may only export a default component.
export default function DarkFooter({ t, rtl }) {
  return (
    <footer className="border-t border-tnr-line py-6 text-center text-tnr-cream/50 text-xs">
      © {new Date().getFullYear()} {t?.org || 'Tehreek-e-Nojawanan Roundu'} ({t?.short || 'TNR'}) · Developed by:{' '}
      <a href="https://www.northdigitaltech.com/" target="_blank" rel="noopener noreferrer"
        className="font-semibold hover:underline" style={{ color: '#4FC3F7' }}>Shabbir Hussain</a>
    </footer>
  );
}
