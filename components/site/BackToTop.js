'use client';
import { useEffect, useRef, useState } from 'react';
import { COLORS } from '@/lib/design/tokens';

const SHOW_AFTER = 420;   // px scrolled before the button appears
const R = 21;             // progress ring radius
const CIRC = 2 * Math.PI * R;

/* Back-to-top control, mounted once in the root layout so every page has it.
 *
 * The ring around the arrow fills as the page scrolls, so it doubles as a
 * reading-progress indicator instead of being a bare floating button.
 *
 * Position: it sits directly above the "Ask TNR AI" fab on pages that have one
 * and drops to the corner on pages that don't. The fab is found by id after
 * mount rather than passed down as a prop, so no page has to remember to
 * declare it — a page that adds the fab later gets the right spacing for free.
 */
export default function BackToTop() {
  const [pct, setPct] = useState(0);
  const [shown, setShown] = useState(false);
  const [raised, setRaised] = useState(false);
  const frame = useRef(0);

  useEffect(() => {
    setRaised(!!document.getElementById('tnr-ai-fab'));

    const read = () => {
      frame.current = 0;
      const top = window.scrollY || document.documentElement.scrollTop || 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setShown(top > SHOW_AFTER);
      setPct(max > 0 ? Math.min(1, Math.max(0, top / max)) : 0);
    };
    // Throttled to one read per frame — scroll fires far more often than that.
    const onScroll = () => { if (!frame.current) frame.current = requestAnimationFrame(read); };

    read();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, []);

  function toTop() {
    // Honour the OS "reduce motion" setting — a long smooth scroll can be
    // genuinely unpleasant for people with vestibular sensitivity.
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  }

  return (
    <button
      onClick={toTop}
      aria-label="Back to top"
      // Hidden from the tab order while invisible, so keyboard users do not
      // land on a button they cannot see.
      tabIndex={shown ? 0 : -1}
      aria-hidden={!shown}
      className={`fixed right-4 sm:right-6 z-[59] grid place-items-center h-12 w-12 rounded-full
        shadow-tnr-raise transition-all duration-300
        ${shown ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3 pointer-events-none'}
        hover:-translate-y-0.5 active:scale-95`}
      style={{
        bottom: raised ? 84 : 20,
        background: `linear-gradient(150deg,${COLORS.green800},${COLORS.green950})`,
        border: `1px solid ${COLORS.gold500}`,
      }}>

      {/* Scroll progress ring */}
      <svg width="48" height="48" viewBox="0 0 48 48" aria-hidden="true"
        className="absolute inset-0 -rotate-90">
        <circle cx="24" cy="24" r={R} fill="none" stroke="rgba(255,255,255,.16)" strokeWidth="2" />
        <circle cx="24" cy="24" r={R} fill="none" stroke={COLORS.gold400} strokeWidth="2"
          strokeLinecap="round" strokeDasharray={CIRC}
          strokeDashoffset={CIRC * (1 - pct)}
          style={{ transition: 'stroke-dashoffset .12s linear' }} />
      </svg>

      {/* Arrow */}
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="relative">
        <path d="M12 19V5M12 5l-6 6M12 5l6 6" stroke={COLORS.gold400}
          strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
