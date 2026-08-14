'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ChevronDown, UserPlus, LogIn } from 'lucide-react';
import { COLORS } from '@/lib/design/tokens';

/* The hero's call to action.
 *
 * ONE button. Pressing it opens a short menu holding the slide's two links —
 * registering and signing in — rather than putting two competing buttons side
 * by side. Two equally weighted buttons make the reader choose before they
 * have decided anything; one button asks them to step forward, and the choice
 * comes after.
 *
 * Both destinations still come from the slide record, so an admin changes the
 * wording and the links in Admin → Hero Slides without touching code. When a
 * slide has only one CTA there is nothing to choose between, and this renders
 * as an ordinary link with no menu.
 */
export default function HeroCtaMenu({ cta1, cta2, align = 'left' }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const btnRef = useRef(null);
  const firstItemRef = useRef(null);

  const items = [cta1, cta2].filter(c => c?.label);

  /* Close on outside click and on Escape.
   *
   * Escape matters more than it looks: a menu that can only be closed by
   * clicking elsewhere is a trap for anyone navigating by keyboard, who has no
   * "elsewhere" to click. Focus returns to the button so the next Tab carries
   * on from where they were. */
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') { setOpen(false); btnRef.current?.focus(); }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Opening with the keyboard should land on the first choice, not leave focus
  // behind on the button with a menu floating unreachable below it.
  useEffect(() => { if (open) firstItemRef.current?.focus(); }, [open]);

  if (!items.length) return null;

  const primary =
    'group inline-flex items-center gap-2 rounded-tnr px-6 py-3.5 font-bold text-white ' +
    'shadow-tnr-raise transition-transform duration-micro hover:-translate-y-[2px] ' +
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#D7AE4A] focus-visible:ring-offset-transparent';
  const primaryStyle = {
    background: `linear-gradient(180deg,${COLORS.green700},${COLORS.green900})`,
    border: `1px solid ${COLORS.gold500}66`,
  };

  // A single CTA needs no menu — a button that opens a list of one is a wasted
  // press and reads as though something is missing.
  if (items.length === 1) {
    const only = items[0];
    return (
      <a href={only.href || '#'} className={primary} style={primaryStyle}>
        {only.label}
        <ArrowRight size={17} strokeWidth={2.5} aria-hidden="true"
          className="transition-transform duration-micro group-hover:translate-x-0.5" />
      </a>
    );
  }

  // First item is the joining action, second is signing in — matching the
  // order the slide defines them in.
  const ICONS = [UserPlus, LogIn];

  return (
    <div ref={wrapRef} className="relative inline-block">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={primary}
        style={primaryStyle}>
        {cta1.label}
        <ChevronDown size={17} strokeWidth={2.5} aria-hidden="true"
          className={`transition-transform duration-micro ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          role="menu"
          aria-label={cta1.label}
          className={`absolute z-30 mt-2 w-60 overflow-hidden rounded-tnr border shadow-tnr-raise
            ${align === 'center' ? 'left-1/2 -translate-x-1/2' : 'left-0'}`}
          style={{ background: '#fff', borderColor: 'rgba(0,0,0,.10)' }}>
          {items.map((c, i) => {
            const Icon = ICONS[i] || ArrowRight;
            return (
              <a
                key={`${c.label}-${i}`}
                ref={i === 0 ? firstItemRef : null}
                role="menuitem"
                href={c.href || '#'}
                className="flex items-center gap-3 px-4 py-3.5 text-sm font-bold transition-colors
                  hover:bg-[rgba(23,107,73,.08)] focus:bg-[rgba(23,107,73,.08)] focus:outline-none
                  border-b last:border-b-0"
                style={{ color: COLORS.green900, borderColor: 'rgba(0,0,0,.06)' }}>
                <Icon size={16} strokeWidth={2.4} aria-hidden="true" style={{ color: COLORS.green700 }} />
                {c.label}
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
