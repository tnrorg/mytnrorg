'use client';
import { useEffect } from 'react';

/* The pointer half of the card hover.
 *
 * The hover itself — lift, edge, glow, shadow — is plain CSS on `.tnr-pop`
 * (app/globals.css) and works without this file. What CSS cannot know is
 * WHERE on the card the cursor is. This tells it, by writing four custom
 * properties onto whichever card the mouse is over:
 *
 *   --pop-x / --pop-y    where the glow sits, as a percentage of the card
 *   --pop-rx / --pop-ry  how far the card tilts toward the cursor
 *
 * ONE LISTENER FOR THE WHOLE SITE, on the document, rather than a handler on
 * every card. There are dozens of cards on the home page and each would need
 * its own component wrapper; this way a card is just a class name, a server
 * component can use it, and a card added next month works without anyone
 * remembering to wire it up.
 *
 * Cheap by construction: mouse movement only records the position, and the
 * styles are written at most once per frame, to one element.
 *
 * Mouse only, and not at all for reduced motion — the CSS ignores the tilt in
 * both cases anyway, so this simply does not run.
 *
 * To remove it, delete <CardFx /> from app/layout.js. Cards keep their hover;
 * they just stop tilting and the glow stays at the top centre.
 */

/* Degrees at the card's edge. Small on purpose: past about 6° text on the far
   side starts to look squeezed, and the effect reads as a toy. */
const MAX_TILT = 5;
/* Cards wider or taller than this tilt proportionally less. The same angle on
   a card twice the size moves its edge twice as far, and a large panel
   swinging 5° is a lurch, not a nudge. */
const REFERENCE_SIZE = 380;

const clamp01 = (v) => Math.min(1, Math.max(0, v));

export default function CardFx() {
  useEffect(() => {
    const fine = window.matchMedia?.('(hover: hover) and (pointer: fine)');
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)');

    let card = null;     // the card under the pointer, if any
    let rect = null;     // its box, measured once on entry (see below)
    let x = 0, y = 0;    // last pointer position
    let raf = 0;

    /* Level the card again and forget it. The glow's position is left where
       it was: it is fading out, and snapping it back to the default first
       would make it visibly jump on the way. */
    const release = () => {
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      if (card) {
        card.style.removeProperty('--pop-rx');
        card.style.removeProperty('--pop-ry');
      }
      card = null;
      rect = null;
    };

    const apply = () => {
      raf = 0;
      if (!card || !rect) return;
      const fx = clamp01((x - rect.left) / rect.width);
      const fy = clamp01((y - rect.top) / rect.height);
      card.style.setProperty('--pop-x', `${(fx * 100).toFixed(1)}%`);
      card.style.setProperty('--pop-y', `${(fy * 100).toFixed(1)}%`);
      if (card.classList.contains('tnr-pop--flat')) return;

      const tilt = MAX_TILT * Math.min(1, REFERENCE_SIZE / Math.max(rect.width, rect.height));
      // The side under the cursor dips away: cursor right → right edge back.
      card.style.setProperty('--pop-ry', `${((fx - 0.5) * 2 * tilt).toFixed(2)}deg`);
      card.style.setProperty('--pop-rx', `${((0.5 - fy) * 2 * tilt).toFixed(2)}deg`);
    };

    const onMove = (e) => {
      if (e.pointerType && e.pointerType !== 'mouse') return;
      if (!fine?.matches || reduce?.matches) { if (card) release(); return; }

      const el = e.target instanceof Element ? e.target.closest('.tnr-pop') : null;
      if (el !== card) {
        release();
        card = el;
        /* Measured ONCE, as the pointer arrives, and not again while it stays.
           The card is about to lift, grow and tilt — all of which change the
           box getBoundingClientRect reports. Re-measuring every frame would
           feed the tilt back into its own input, and the card would shimmer
           as the two chased each other. */
        const r = el?.getBoundingClientRect();
        rect = r && r.width > 0 && r.height > 0 ? r : null;
        if (!rect) card = null;
      }
      if (!card) return;
      x = e.clientX;
      y = e.clientY;
      if (!raf) raf = requestAnimationFrame(apply);
    };

    /* The page moving under a still cursor changes which card is hovered
       without any mouse event, and makes the stored box wrong. Let go; the
       next movement picks up whatever is under the pointer then. */
    const onLeaveWindow = (e) => { if (!e.relatedTarget) release(); };

    document.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerout', onLeaveWindow, { passive: true });
    window.addEventListener('scroll', release, { passive: true, capture: true });
    window.addEventListener('resize', release, { passive: true });
    window.addEventListener('blur', release);

    return () => {
      release();
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerout', onLeaveWindow);
      window.removeEventListener('scroll', release, { capture: true });
      window.removeEventListener('resize', release);
      window.removeEventListener('blur', release);
    };
  }, []);

  return null;
}
