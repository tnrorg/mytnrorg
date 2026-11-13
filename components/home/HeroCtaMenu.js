'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ChevronDown, UserPlus, LogIn } from 'lucide-react';

/* The hero's calls to action.
 *
 * TWO BUTTONS, with different weights: the slide's first link is the gold
 * primary, its second a quiet outline. They are not equals and are not drawn
 * as equals — one says "do this", the other "or look around first" — which is
 * what stops two buttons side by side from reading as a choice the visitor has
 * to make before they have decided anything.
 *
 * Both come from the slide record (Admin → Hero Slides), so wording and
 * destinations are changed there, not here.
 *
 * THE MENU IS STILL AVAILABLE. A slide that sets its own button label —
 * "Join / Login TNR" — is asking for one button that opens onto its two links,
 * and gets exactly that. Leaving the label empty gives two buttons. Nothing
 * about an existing slide changes until an admin edits it.
 *
 * `inert` — the slide is not the one on screen. Its links stay in the page (so
 * the hero keeps a constant height) but must not be reachable by Tab.
 */
export default function HeroCtaMenu({ cta1, cta2, buttonLabel, align = 'left', inert = false }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const btnRef = useRef(null);
  const firstItemRef = useRef(null);

  const items = [cta1, cta2].filter(c => c?.label);
  const asMenu = items.length === 2 && !!buttonLabel?.trim();

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

  // A menu left open must not survive its slide leaving the screen.
  useEffect(() => { if (inert) setOpen(false); }, [inert]);

  if (!items.length) return null;
  const tab = inert ? -1 : undefined;

  if (asMenu) {
    // First item is the joining action, second is signing in — matching the
    // order the slide defines them in.
    const ICONS = [UserPlus, LogIn];
    return (
      <div ref={wrapRef} className="relative inline-flex">
        <button ref={btnRef} type="button" tabIndex={tab}
          onClick={() => setOpen(o => !o)}
          aria-haspopup="menu" aria-expanded={open}
          className="tnr-hero-btn tnr-hero-btn--primary w-full sm:w-auto">
          <span>{buttonLabel.trim()}</span>
          <ChevronDown size={17} strokeWidth={2.6} aria-hidden="true" className="tnr-hero-chevron" />
        </button>

        {open && (
          <div role="menu" aria-label={buttonLabel.trim()} className="tnr-hero-menu animate-fade-up"
            style={align === 'center' ? { left: '50%', marginLeft: '-7.5rem' } : undefined}>
            {items.map((c, i) => {
              const Icon = ICONS[i] || ArrowRight;
              return (
                <a key={`${c.label}-${i}`} ref={i === 0 ? firstItemRef : null}
                  role="menuitem" href={c.href || '#'}>
                  <Icon size={16} strokeWidth={2.4} aria-hidden="true" style={{ color: '#176B49' }} />
                  {c.label}
                </a>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      {items.map((c, i) => (
        <a key={`${c.label}-${i}`} href={c.href || '#'} tabIndex={tab}
          className={`tnr-hero-btn ${i === 0 ? 'tnr-hero-btn--primary' : 'tnr-hero-btn--ghost'}`}>
          <span>{c.label}</span>
          <ArrowRight size={17} strokeWidth={2.6} aria-hidden="true" className="tnr-hero-arrow" />
        </a>
      ))}
    </>
  );
}
