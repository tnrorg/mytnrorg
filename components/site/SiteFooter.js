'use client';
import { NAV, FOOTER_LINKS } from './navConfig';

const mont = { fontFamily: 'var(--font-mulish), Mulish, system-ui, sans-serif' };

export default function SiteFooter() {
  // Only columns that still have at least one live link — otherwise a
  // heading would sit above an empty list (Initiatives, Media and Contact are
  // entirely planned pages at the moment).
  const cols = NAV.filter(n => (n.items || []).some(i => !i.soon)).slice(0, 4);
  return (
    <footer className="mt-auto">
      <div style={{ background: '#063D2B' }} className="text-white">
        <div className="max-w-[1400px] mx-auto px-4 py-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-1">
            <div className="flex items-center gap-2.5">
              <span className="w-11 h-11 rounded-full grid place-items-center bg-white ring-2 ring-[#D4A72C] overflow-hidden">
                <img src="/tnr-logo.png" alt="TNR" className="w-full h-full object-contain p-0.5" />
              </span>
              <span style={mont} className="font-extrabold">TNR</span>
            </div>
            <p className="mt-3 text-sm text-white/60 leading-relaxed">
              Tehreek-e-Nojawanan Roundu — serving the Rondo community through education,
              welfare, and youth empowerment.
            </p>
          </div>
          {cols.map(c => (
            <div key={c.label}>
              <h4 style={mont} className="text-[13px] font-bold uppercase tracking-wider text-[#F3E4B3]">{c.label}</h4>
              <ul className="mt-3 space-y-1.5">
                {c.items.filter(i => !i.soon).slice(0, 6).map(i => (
                  <li key={i.label}>
                    <a href={i.href} className="text-sm text-white/60 hover:text-white transition-colors duration-micro">{i.label}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-white/10">
          <div className="max-w-[1400px] mx-auto px-4 py-4 flex flex-wrap gap-x-4 gap-y-2 justify-center">
            {FOOTER_LINKS.filter(i => !i.soon).map(i => (
              <a key={i.label} href={i.href} className="text-xs text-white/50 hover:text-white transition-colors duration-micro">{i.label}</a>
            ))}
          </div>
        </div>
      </div>

      <div className="py-5 text-center text-xs text-white" style={{ background: '#000000' }}>
        © {new Date().getFullYear()} Tehreek-e-Nojawanan Roundu (TNR) · Developed by:{' '}
        <a href="https://www.northdigitaltech.com/" target="_blank" rel="noopener noreferrer"
          className="font-semibold hover:underline" style={{ color: '#4FC3F7' }}>Shabbir Hussain</a>
      </div>
    </footer>
  );
}
