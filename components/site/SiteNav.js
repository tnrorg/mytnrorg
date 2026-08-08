'use client';
import { useState, useEffect, useRef } from 'react';
import { NAV } from './navConfig';
import { HEADER_DEFAULTS, SOCIALS, normaliseUrl } from '@/lib/siteHeader';

const G = '#063D2B', GOLD = '#D4A72C';
const mont = { fontFamily: 'var(--font-mulish), Mulish, system-ui, sans-serif' };

/* A dropdown entry. Planned pages render as a non-clickable row with a "Soon"
   chip rather than a link to a 404 — the roadmap stays visible and honest. */
/* The gold person icon used to go straight to the application form, which was
 * wrong for the many people who have already applied: they arrived at a blank
 * form instead of a way in. It now opens a small menu with both routes. */
function AccountMenu({ open, onClose, align = 'left' }) {
  if (!open) return null;
  const rows = [
    ['Register as a Member', 'Join TNR — new application', '/membership/apply', true],
    ['Member Login', 'Already approved? Sign in', '/member/login'],
    ['Check Application Status', 'Track an application you have submitted', '/membership/status'],
  ];
  return (
    <div className={`absolute top-full mt-2 w-64 z-50 ${align === 'right' ? 'right-0' : 'left-0'}`}>
      <div className="rounded-2xl bg-white shadow-2xl border border-gray-100 py-2 animate-fade-up" style={mont}>
        {rows.map(([label, note, href, primary]) => (
          <a key={href} href={href} onClick={onClose}
            className="block px-4 py-2.5 hover:bg-[#0B6B4F]/5 transition-colors">
            <div className="text-sm font-bold" style={{ color: primary ? '#0B6B4F' : G }}>{label}</div>
            <div className="text-[11px] text-gray-500 leading-snug">{note}</div>
          </a>
        ))}
      </div>
    </div>
  );
}

function NavLink({ item, onNavigate, className }) {
  if (item.soon) return (
    <span className={`${className} flex items-center justify-between cursor-default text-gray-400`}
      aria-disabled="true">
      {item.label}
      <span className="ml-2 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide
        bg-gray-100 text-gray-400">Soon</span>
    </span>
  );
  return <a href={item.href} onClick={onNavigate} className={className}>{item.label}</a>;
}

export default function SiteNav() {
  const [open, setOpen] = useState(null);      // desktop dropdown label
  const [mobile, setMobile] = useState(false);
  const [acc, setAcc] = useState(null);        // mobile accordion
  const [search, setSearch] = useState(false);
  const [account, setAccount] = useState(false);   // Register / Login popover
  const ref = useRef(null);

  useEffect(() => {
    // A click anywhere outside the header bar closes both the nav dropdown and
    // the account menu; Escape does the same from the keyboard.
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) { setOpen(null); setAccount(false); }
    };
    const onKey = (e) => { if (e.key === 'Escape') { setOpen(null); setAccount(false); } };
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
      <div ref={ref} className="max-w-[1400px] mx-auto px-4 py-2.5 flex items-center gap-3">
        {/* Mobile: account menu on the LEFT */}
        <div className="xl:hidden relative shrink-0">
          <button onClick={() => setAccount(o => !o)} aria-label="Register or log in"
            aria-expanded={account} title="Register or log in"
            className="grid place-items-center w-10 h-10 rounded-full text-[#063D2B] shadow"
            style={{ background: 'linear-gradient(180deg,#F3E4B3,#D4A72C)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <circle cx="9" cy="8" r="3.4" stroke="currentColor" strokeWidth="2" />
              <path d="M2.8 20c0-3.4 2.8-5.6 6.2-5.6s6.2 2.2 6.2 5.6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="M18.5 8.5v5M21 11h-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          <AccountMenu open={account} onClose={() => setAccount(false)} />
        </div>

        {/* Logo — centred on mobile, left on desktop */}
        <a href="/" className="flex items-center gap-2.5 shrink-0 absolute left-1/2 -translate-x-1/2 xl:static xl:translate-x-0">
          <span className="w-10 h-10 rounded-full grid place-items-center bg-white ring-2 ring-[#D4A72C] overflow-hidden shadow">
            <img src="/tnr-logo.png" alt="TNR" className="w-full h-full object-contain p-0.5" />
          </span>
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
          <a href="/member/login" className="hidden xl:inline-block px-3 py-2 rounded-xl text-[13px] font-semibold text-[#063D2B] border border-[#063D2B]/15 hover:bg-[#063D2B]/5">LOGIN</a>
          <div className="hidden xl:block relative">
            <button onClick={() => setAccount(o => !o)} aria-label="Register or log in"
              aria-expanded={account} title="Register or log in"
              className="grid place-items-center w-10 h-10 rounded-full text-[#063D2B] shadow"
              style={{ background: 'linear-gradient(180deg,#F3E4B3,#D4A72C)' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <circle cx="9" cy="8" r="3.4" stroke="currentColor" strokeWidth="2" />
                <path d="M2.8 20c0-3.4 2.8-5.6 6.2-5.6s6.2 2.2 6.2 5.6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M18.5 8.5v5M21 11h-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
            <AccountMenu open={account} onClose={() => setAccount(false)} align="right" />
          </div>
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
