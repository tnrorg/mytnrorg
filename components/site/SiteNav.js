'use client';
import { useState, useEffect, useRef } from 'react';
import { NAV } from './navConfig';
import { HEADER_DEFAULTS, SOCIALS, normaliseUrl } from '@/lib/siteHeader';

const G = '#063D2B', GOLD = '#D4A72C';
const mont = { fontFamily: 'var(--font-mulish), Mulish, system-ui, sans-serif' };

/* A dropdown entry. Planned pages render as a non-clickable row with a "Soon"
   chip rather than a link to a 404 — the roadmap stays visible and honest. */
export default function SiteNav() {
  const [open, setOpen] = useState(null);      // desktop dropdown label
  const [mobile, setMobile] = useState(false);
  const [acc, setAcc] = useState(null);        // mobile accordion
  const [search, setSearch] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    // A click anywhere outside the header bar closes the nav dropdown;
    // Escape does the same from the keyboard.
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(null);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(null); };
    document.addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', close);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  // Full-screen mobile menu: stop the page behind it from scrolling.
  useEffect(() => {
    document.body.style.overflow = mobile ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobile]);

  // Utility-bar content. Starts from the defaults so the bar renders complete
  // on first paint and never flashes empty while the request is in flight.
  const [header, setHeader] = useState(HEADER_DEFAULTS);
  useEffect(() => {
    let off = false;
    fetch('/api/public/site-header', { cache: 'no-store' })
      .then(r => r.json())
      .then(j => { if (!off && j?.ok && j.header) setHeader(j.header); })
      .catch(() => {});
    return () => { off = true; };
  }, []);

  return (
    <>
    {/* Utility bar — tagline and social links come from Admin → Branding.
        The links used to be hardcoded to bare domains (facebook.com etc), so
        every icon led to a generic homepage rather than TNR's own page. */}
    <div className="hidden sm:block text-white text-[12px]" style={{ background: '#052A1E' }}>
      <div className="max-w-[1400px] mx-auto px-4 py-1.5 flex items-center gap-4">
        <span className="text-white/70">{header.header_tagline}</span>
        <div className="ml-auto flex items-center gap-4">
          <a href="/help" className="text-white/70 hover:text-white transition">Help Center</a>
          <a href="/contact" className="text-white/70 hover:text-white transition">Contact Us</a>
          <div className="flex items-center gap-2">
            {SOCIALS.map(([key, label, name]) => {
              const href = normaliseUrl(header[key]);
              // No account configured — render nothing rather than a dead icon.
              if (!href) return null;
              return (
                <a key={key} href={href} target="_blank" rel="noopener noreferrer"
                  aria-label={name} title={name}
                  className="w-5 h-5 rounded grid place-items-center bg-white/10 hover:bg-[#D4A72C] hover:text-[#063D2B] transition text-[10px] font-bold">
                  {label}
                </a>
              );
            })}
          </div>
        </div>
      </div>
    </div>
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-100 shadow-sm relative">
      <div ref={ref} className="relative max-w-[1400px] mx-auto px-4 py-2.5 flex items-center gap-3">
        {/* Logo, left on every breakpoint — where a reader looks for "home",
            and where a screen reader lands first. */}
        <a href="/" aria-label="Tehreek-e-Nojawanan Roundu — home"
          className="flex items-center shrink-0">
          {/* Bare mark — no gold ring, no white disc. The logo already carries
              its own circular border, so the added ring read as a second one. */}
          <img src="/tnr-logo.png" alt="TNR" className="h-11 w-auto object-contain" />
        </a>

        {/* Desktop nav */}
        <nav className="hidden xl:flex items-center gap-0.5 mx-auto">
          {NAV.map(n => (
            <div key={n.label} className="relative"
              onMouseEnter={() => n.items && setOpen(n.label)}
              onMouseLeave={() => n.items && setOpen(null)}>
              <a href={n.href || '#'}
                className={`flex items-center gap-1 px-2.5 py-2 rounded-lg text-[13px] font-semibold uppercase tracking-wide transition whitespace-nowrap
                  ${n.highlight ? 'text-[#0B6B4F]' : 'text-gray-600'} hover:text-[#0B6B4F] hover:bg-[#0B6B4F]/5`}>
                {n.label}
                {n.items && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" className="opacity-50">
                  <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>}
              </a>
              {n.items && open === n.label && (
                <div className="absolute left-0 top-full pt-1 w-60">
                  <div className="rounded-2xl bg-white shadow-2xl border border-gray-100 py-2 animate-fade-up">
                    {n.items.map(item => (
                      <NavLink key={item.label} item={item}
                        className="block px-4 py-2 text-sm text-gray-600 hover:text-[#0B6B4F] hover:bg-[#0B6B4F]/5 transition-colors duration-micro" />
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-2 ml-auto">
          <button onClick={() => setSearch(!search)} aria-label="search"
            className="hidden xl:grid place-items-center w-9 h-9 rounded-lg text-gray-500 hover:bg-gray-100">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
              <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
          {/* The gold register button used to sit here. Registration now lives
              on the hero's "Join TNR" call to action; the hamburger menu still
              carries Register and Member Login, so no route was lost — mobile
              visitors would otherwise have had no way to sign in. */}
          <a href="/member/login" className="hidden xl:inline-block px-3 py-2 rounded-xl text-[13px] font-semibold text-[#063D2B] border border-[#063D2B]/15 hover:bg-[#063D2B]/5">LOGIN</a>
          <a href="/membership/apply"
            className="hidden xl:inline-block px-4 py-2 rounded-xl text-[13px] font-bold text-white"
            style={{ background: 'linear-gradient(180deg,#0B6B4F,#063D2B)', border: '1px solid rgba(200,154,43,.4)' }}>
            REGISTER
          </a>
          <button className="xl:hidden p-2 -mr-1 text-gray-600" onClick={() => setMobile(!mobile)} aria-label="menu">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
        </div>
      </div>

      {search && (
        <div className="border-t border-gray-100 bg-white px-4 py-3">
          <div className="max-w-[1400px] mx-auto">
            <input autoFocus placeholder="Search TNR — members, scholarships, jobs, news…"
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-[#0B6B4F]" />
          </div>
        </div>
      )}

      {/* Mobile menu */}
    </header>

      {mobile && (
        <div className="xl:hidden fixed inset-x-0 top-[61px] bottom-0 z-[45] bg-white overflow-y-auto overscroll-contain">
          {NAV.map(n => (
            <div key={n.label} className="border-b border-gray-50">
              {n.items ? (
                <>
                  <button onClick={() => setAcc(acc === n.label ? null : n.label)}
                    className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold uppercase tracking-wide text-gray-700">
                    {n.label}
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className={`transition ${acc === n.label ? 'rotate-180' : ''}`}>
                      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </button>
                  {acc === n.label && (
                    <div className="pb-2 bg-gray-50/60">
                      {n.href && <a href={n.href} className="block px-7 py-2 text-sm font-semibold text-[#0B6B4F]">Open {n.label} →</a>}
                      {n.items.map(item => (
                        <NavLink key={item.label} item={item} onNavigate={() => setMobile(false)}
                          className="block px-7 py-2.5 text-sm text-gray-600" />
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <a href={n.href} onClick={() => setMobile(false)}
                  className="block px-4 py-3 text-sm font-semibold uppercase tracking-wide text-gray-700">{n.label}</a>
              )}
            </div>
          ))}
          {/* Both routes at the foot of the drawer, so someone who scrolls the
              whole menu still finds a way in without going back to the top. */}
          <div className="p-4 space-y-2.5">
            <a href="/membership/apply" onClick={() => setMobile(false)}
              className="block text-center px-4 py-3 rounded-xl text-sm font-bold text-white"
              style={{ background: 'linear-gradient(180deg,#0B6B4F,#063D2B)' }}>
              Register as a Member
            </a>
            <a href="/member/login" onClick={() => setMobile(false)}
              className="block text-center px-4 py-3 rounded-xl text-sm font-bold border"
              style={{ borderColor: 'rgba(6,61,43,.18)', color: G }}>
              Member Login
            </a>
            <a href="/membership/status" onClick={() => setMobile(false)}
              className="block text-center px-4 py-2 text-[12px] font-semibold text-gray-500">
              Check application status
            </a>
          </div>
        </div>
      )}
    </>
  );
}
