'use client';
import { useState, useEffect, useRef, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { motion, useScroll, useSpring } from 'framer-motion';
import { NAV } from './navConfig';
import AccountMenu from './AccountMenu';
import SearchOverlay from '@/components/search/SearchOverlay';

/* ── TNR header ───────────────────────────────────────────────────────────────
 *
 * A single deep-green capsule that floats over the page, in TNR's own palette:
 * logo on a light disc at the left, the sections centred, the current section
 * marked by a lighter pill, and one solid light button carrying Register.
 *
 * Two things about it are load-bearing rather than decorative:
 *
 * 1. THE BAR IS NARROWER THAN A FULL-WIDTH ROW, SO THE LABELS HAD TO SHRINK.
 *    Measured on the live site at a 1440px viewport, the eleven full-length
 *    labels needed 1355px — against roughly 1140px left in the container once
 *    the logo and the sign-in buttons had taken their share. The bar was
 *    already over budget before this redesign. The capsule renders each
 *    section's `short` label where navConfig gives one, at 12px rising to
 *    12.5px above 1536px, which brings the set inside the width at the 1280px
 *    breakpoint where the desktop bar first appears. The full names are
 *    untouched and are still what the mobile drawer shows.
 *
 * 2. THE SECTIONS WITH NO PAGE OF THEIR OWN ARE NO LONGER href="#".
 *    Initiatives, Media and Contact have no top-level route. They used to
 *    render as a link to "#", which scrolls a visitor to the top of whatever
 *    they were reading and looks broken. Each now points at its first built
 *    child instead, and where every child is still planned — Initiatives — it
 *    renders a real button that opens the menu, so it works by keyboard and
 *    on a touch screen as well as on hover.
 */
const mont = { fontFamily: 'var(--font-mulish), Mulish, system-ui, sans-serif' };

/* A dropdown entry. Planned pages render as a non-clickable row with a "Soon"
   chip rather than a link to a 404 — the roadmap stays visible and honest. */
function NavLink({ item, onNavigate, className }) {
  /* "Soon" items are greyed to read as unavailable, but grey-on-grey was
   * taking that to 2.3:1 — the label was decorative rather than legible, and
   * anyone with low vision simply could not read which features are coming.
   * gray-600 on gray-100 is 6.9:1 and still clearly muted beside a live link. */
  if (item.soon) return (
    <span className={`${className} flex items-center justify-between cursor-default text-gray-600`}
      aria-disabled="true">
      {item.label}
      <span className="ml-2 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide
        bg-gray-100 text-gray-600">Soon</span>
    </span>
  );
  return <a href={item.href} onClick={onNavigate} className={className}>{item.label}</a>;
}

/* Strip the query and the fragment, and the trailing slash, so
   '/opportunities?category=Job' and '/election-portal#process' compare as the
   routes they actually are. */
const routeOf = (href) => String(href).split('?')[0].split('#')[0].replace(/\/+$/, '');

export default function SiteNav() {
  const [open, setOpen] = useState(null);      // desktop dropdown label
  const [mobile, setMobile] = useState(false);
  const [acc, setAcc] = useState(null);        // mobile accordion
  const [search, setSearch] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  /* How far down the page the reader is, 0 → 1, as a motion value: scrolling
     updates one transform on one element and re-renders nothing. The spring
     only takes the steps out of it — a mouse wheel moves the page in jumps,
     and a bar that jumps with it looks like a loading bar that is struggling. */
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 140, damping: 26, mass: 0.3 });
  const ref = useRef(null);
  const pathname = usePathname() || '/';

  /* Which section is the visitor in?
   *
   * LONGEST MATCH WINS, and that is the whole point. Several sections share a
   * prefix — About TNR owns /about, while Leadership owns /about/advisory-council
   * and /about/executive-committee under it. A plain startsWith test lights up
   * both, and two highlighted pills tell the visitor nothing. Scoring by the
   * length of the matched route picks the more specific owner, so the council
   * page marks Leadership and only Leadership. */
  const activeLabel = useMemo(() => {
    if (pathname === '/') return 'Home';
    let best = null, bestLen = 0;
    for (const n of NAV) {
      for (const href of [n.href, ...(n.items || []).map(i => i.href)]) {
        if (!href) continue;
        const p = routeOf(href);
        if (!p) continue;   // '/' — only ever matched by the exact test above
        const hit = pathname === p || pathname.startsWith(`${p}/`);
        if (hit && p.length > bestLen) { bestLen = p.length; best = n.label; }
      }
    }
    return best;
  }, [pathname]);

  useEffect(() => {
    // A click anywhere outside the header bar closes the nav dropdown;
    // Escape does the same from the keyboard.
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(null);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') { setOpen(null); setMobile(false); setSearch(false); }
      /* Ctrl+K / Cmd+K opens search from anywhere on the page. preventDefault
         because browsers bind the same keys to their own address-bar search. */
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(null); setMobile(false); setSearch(true);
      }
    };
    document.addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', close);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  /* Has the page moved? Once it has, the capsule is floating over content
     rather than over the top of the page, and it is given a deeper shadow and
     a frosted edge to say so.

     Passive, and it only sets state when the answer CHANGES — so scrolling the
     whole page costs two renders, not one per frame. Nothing about the
     capsule's size changes, so the page beneath never shifts. */
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Full-screen mobile menu: stop the page behind it from scrolling.
  useEffect(() => {
    document.body.style.overflow = mobile ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobile]);

  return (
    <>
    {/* There is no bar above the capsule any more.

        The dark strip that used to sit here — tagline, "Help Center", "Contact
        Us" and the social icons — was removed at the owner's request. Nothing
        it linked to is unreachable: Contact is in the capsule's own menu and
        "Help Center" pointed at /help, a page that never existed. The social
        icons now appear only in the Follow Us section of the home page — if
        they are wanted on every page, the footer is the place for them.

        The request it made on every page load (/api/public/site-header) went
        with it. Follow Us still makes that request, on the home page only. */}

    {/* The sticky band is transparent and has no backdrop of its own, which is
        what makes the capsule read as floating: the page scrolls past in the
        gap above and beside it, rather than under a full-width panel. */}
    <div className="sticky top-0 z-50 px-2.5 pt-2.5 pb-1 sm:px-4 sm:pt-3.5 sm:pb-1.5 pointer-events-none">
      {/* Gold hairline as an inset ring rather than a border, so it does not
          add to the capsule's box and nudge the 1400px width budget. */}
      <header ref={ref}
        className="pointer-events-auto relative mx-auto flex max-w-[1400px] items-center gap-2 rounded-full p-2"
        style={{
          ...mont,
          /* Very slightly translucent once scrolled, so the blur behind it
             has something to show through; the gold ring brightens a touch.
             Only the shadow animates — a gradient cannot be tweened, and at
             94% the swap is not visible. */
          background: scrolled
            ? 'linear-gradient(100deg,rgba(10,61,44,.94),rgba(14,81,56,.94) 55%,rgba(10,61,44,.94))'
            : 'linear-gradient(100deg,#0A3D2C,#0E5138 55%,#0A3D2C)',
          WebkitBackdropFilter: scrolled ? 'blur(14px) saturate(140%)' : undefined,
          backdropFilter: scrolled ? 'blur(14px) saturate(140%)' : undefined,
          boxShadow: scrolled
            ? '0 18px 44px -14px rgba(4,26,19,.62), 0 2px 8px -2px rgba(4,26,19,.30), inset 0 0 0 1px rgba(200,154,43,.34)'
            : '0 12px 32px -12px rgba(4,26,19,.50), inset 0 0 0 1px rgba(200,154,43,.22)',
          transition: 'box-shadow .35s ease',
        }}>
        {/* Logo, left on every breakpoint — where a reader looks for "home",
            and where a screen reader lands first.

            ON A LIGHT DISC, AND THAT IS NOT A STYLE CHOICE. The mark is 70%
            dark pixels with a mean luminance of 72, so it was drawn for a
            white page; placed straight onto the deep green it all but
            disappears. The disc gives it the light ground it was made for. */}
        <a href="/" aria-label="Tehreek-e-Nojawanan Roundu — home"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white
            transition-transform duration-micro hover:scale-[1.04]"
          style={{ boxShadow: 'inset 0 0 0 1px rgba(200,154,43,.45)' }}>
          <img src="/tnr-logo.png" alt="TNR" className="h-9 w-9 object-contain" />
        </a>

        {/* Desktop nav */}
        <nav className="mx-auto hidden items-center gap-0.5 xl:flex">
          {NAV.map(n => {
            const active = activeLabel === n.label;
            /* No page of its own → its first built child, so the label is
               never a link to nowhere. All children still planned → null, and
               the branch below renders a button instead of a link. */
            const target = n.href || n.items?.find(i => !i.soon)?.href || null;
            const cls = `flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-2 text-[12px]
              font-semibold transition-colors duration-micro 2xl:px-2.5 2xl:text-[12.5px]
              ${active ? 'bg-white/[.16] text-white'
                : n.highlight ? 'text-[#E8C976] hover:bg-white/10 hover:text-[#F3E4B3]'
                : 'text-white/75 hover:bg-white/10 hover:text-white'}`;
            const chevron = n.items && (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true"
                className={`opacity-60 transition-transform duration-micro ${open === n.label ? 'rotate-180' : ''}`}>
                <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="3"
                  strokeLinecap="round" strokeLinejoin="round" /></svg>
            );

            return (
              <div key={n.label} className="relative"
                onMouseEnter={() => n.items && setOpen(n.label)}
                onMouseLeave={() => n.items && setOpen(null)}>
                {target ? (
                  <a href={target} className={cls} aria-current={active ? 'page' : undefined}>
                    {n.short || n.label}{chevron}
                  </a>
                ) : (
                  /* Every child is still planned, so there is nowhere to go.
                     A button that opens the menu is honest about that, and
                     unlike the old href="#" it works from the keyboard. */
                  <button type="button" className={cls}
                    aria-expanded={open === n.label} aria-haspopup="menu"
                    onClick={() => setOpen(o => (o === n.label ? null : n.label))}>
                    {n.short || n.label}{chevron}
                  </button>
                )}

                {n.items && open === n.label && (
                  /* pt-3 rather than a margin: the padding keeps the panel
                     touching the trigger, so moving the pointer down into the
                     menu never crosses a gap that would close it. */
                  <div className="absolute left-0 top-full w-60 pt-3" role="menu">
                    <div className="animate-fade-up rounded-2xl border border-gray-100 bg-white py-2 shadow-2xl">
                      {/* The section's own page, when it has one and the menu
                          is not simply a list of its children. */}
                      {n.href && (
                        <a href={n.href}
                          className="block border-b border-gray-50 px-4 py-2 text-sm font-bold text-[#0B6B4F]
                            transition-colors duration-micro hover:bg-[#0B6B4F]/5">
                          {n.label} overview
                        </a>
                      )}
                      {n.items.map(item => (
                        <NavLink key={item.label} item={item}
                          className="block px-4 py-2 text-sm text-gray-600 transition-colors duration-micro
                            hover:bg-[#0B6B4F]/5 hover:text-[#0B6B4F]" />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Right side */}
        <div className="ml-auto flex items-center gap-1.5">
          <button type="button" onClick={() => { setMobile(false); setSearch(true); }}
            aria-label="Search TNR" aria-haspopup="dialog" aria-expanded={search}
            title="Search (Ctrl+K)"
            className="grid h-10 w-10 place-items-center rounded-full text-white/80
              transition-colors duration-micro hover:bg-white/10 hover:text-white xl:h-9 xl:w-9">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
              <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
          {/* LOGIN + REGISTER for a visitor; the member's own avatar and menu
              once they are signed in. Which one is decided by the server, from
              the token — not by the token's mere presence.
              tone="dark" so both read against the green rather than vanishing. */}
          <AccountMenu tone="dark" />
          <button type="button" onClick={() => setMobile(m => !m)}
            aria-label="Menu" aria-expanded={mobile}
            className="grid h-10 w-10 place-items-center rounded-full text-white
              transition-colors duration-micro hover:bg-white/10 xl:hidden">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" /></svg>
          </button>
        </div>

        {/* Reading progress: a gold hairline along the foot of the capsule that
            fills as the page is scrolled. Inset far enough to stay inside the
            capsule's rounded ends, decorative (aria-hidden) and click-through,
            and empty at the top of the page — so it is not there at all until
            the reader has started moving. */}
        <span aria-hidden="true" data-nav-progress=""
          className="pointer-events-none absolute bottom-[3px] left-8 right-8 h-[2px] overflow-hidden rounded-full">
          <motion.span className="block h-full w-full origin-left rounded-full"
            style={{ scaleX: progress,
              background: 'linear-gradient(90deg,rgba(200,154,43,.55),#E6C36A 60%,#F4DC9A)' }} />
        </span>
      </header>

    </div>

    {/* Global search. Portalled to <body> by the component itself, so it is
        not trapped inside the sticky capsule's stacking context. */}
    <SearchOverlay open={search} onClose={() => setSearch(false)} />

    {/* Mobile menu.
        Covers the whole viewport and carries its own header row. It used to be
        pinned to top-[61px] — a hard-coded guess at the header's height, which
        the capsule has now changed. Owning the full screen removes the magic
        number for good. */}
    {mobile && (
      <div className="fixed inset-0 z-[60] overflow-y-auto overscroll-contain bg-white xl:hidden"
        style={mont}>
        <div className="sticky top-0 flex items-center gap-2 px-4 py-3"
          style={{ background: 'linear-gradient(100deg,#0A3D2C,#0E5138 55%,#0A3D2C)' }}>
          <span className="grid h-10 w-10 place-items-center rounded-full bg-white">
            <img src="/tnr-logo.png" alt="" aria-hidden="true" className="h-8 w-8 object-contain" />
          </span>
          <span className="text-[13px] font-bold uppercase tracking-wide text-white">Menu</span>
          <button type="button" onClick={() => setMobile(false)} aria-label="Close menu"
            className="ml-auto grid h-10 w-10 place-items-center rounded-full text-white
              transition-colors duration-micro hover:bg-white/10">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" /></svg>
          </button>
        </div>

        {NAV.map(n => (
          <div key={n.label} className="border-b border-gray-50">
            {n.items ? (
              <>
                <button onClick={() => setAcc(acc === n.label ? null : n.label)}
                  aria-expanded={acc === n.label}
                  className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold
                    uppercase tracking-wide text-gray-700">
                  {n.label}
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true"
                    className={`transition ${acc === n.label ? 'rotate-180' : ''}`}>
                    <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="3"
                      strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
                {acc === n.label && (
                  <div className="bg-gray-50/60 pb-2">
                    {n.href && <a href={n.href} onClick={() => setMobile(false)}
                      className="block px-7 py-2 text-sm font-semibold text-[#0B6B4F]">Open {n.label} →</a>}
                    {n.items.map(item => (
                      <NavLink key={item.label} item={item} onNavigate={() => setMobile(false)}
                        className="block px-7 py-2.5 text-sm text-gray-600" />
                    ))}
                  </div>
                )}
              </>
            ) : (
              <a href={n.href} onClick={() => setMobile(false)}
                className="block px-4 py-3 text-sm font-semibold uppercase tracking-wide text-gray-700">
                {n.label}
              </a>
            )}
          </div>
        ))}

        {/* At the foot of the drawer, so someone who scrolls the whole menu
            still finds a way in without going back to the top. Shows the
            member's own links once they are signed in. */}
        <div className="space-y-2.5 p-4">
          <AccountMenu variant="mobile" onNavigate={() => setMobile(false)} />
        </div>
      </div>
    )}
    </>
  );
}
