'use client';
import { useEffect } from 'react';

/* Inertia scrolling for mouse wheels.
 *
 * Section reveals alone do not make a site feel smooth — the scroll itself
 * does. A mouse wheel moves the page in hard ~100px steps, and no amount of
 * fade-in disguises that. This eases each step out over a few frames instead.
 *
 * Deliberately narrow, because scroll hijacking done broadly is worse than
 * none at all:
 *
 *   • Wheel only. Touch, trackpad momentum, keyboard, scrollbar dragging and
 *     find-in-page all keep native behaviour — those are already smooth, and
 *     intercepting them is how sites end up feeling broken.
 *   • Coarse pointers (phones, tablets) are skipped entirely.
 *   • Off for anyone who has asked their OS to reduce motion.
 *
 * INNER SCROLLERS ARE SMOOTHED TOO, which they previously were not.
 *
 * This used to bail out the moment the pointer was over anything with its own
 * scrollbar. That left the admin sidebar — a pinned column with
 * `overflow-y: auto` and more tabs than fit on screen — moving in hard
 * ~100px steps while the page beside it glided. Two scroll feels in one
 * window reads as the panel being broken rather than as a deliberate
 * exception.
 *
 * Scroll chaining is preserved: when an inner scroller has reached its top or
 * bottom, the wheel is handed back untouched so the page takes over exactly
 * as it does natively.
 *
 * To remove it, delete <SmoothScroll /> from app/layout.js — nothing else
 * depends on it.
 */

const EASE = 0.12;      // fraction of the remaining distance covered per frame
const SETTLE = 0.5;     // px below which the animation stops
const MAX_STEP = 1400;  // cap so a violent flick cannot fling the whole page

export default function SmoothScroll() {
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const coarse = window.matchMedia?.('(pointer: coarse)');
    if (reduce?.matches || coarse?.matches) return;

    let target = window.scrollY;
    let raf = 0;
    let running = false;

    /* The inner scroller being eased, if any, and where it is headed.
     * Only ever one at a time — a wheel has a single pointer. */
    let innerEl = null;
    let innerTarget = 0;
    let innerRaf = 0;
    let innerRunning = false;

    /** The nearest ancestor that scrolls on its own, or null for the page. */
    const innerScrollerAt = (el) => {
      for (let n = el; n && n !== document.body && n !== document.documentElement; n = n.parentElement) {
        const s = getComputedStyle(n);
        if (/(auto|scroll)/.test(s.overflowY) && n.scrollHeight > n.clientHeight + 1) return n;
      }
      return null;
    };

    const maxScroll = () =>
      Math.max(0, document.documentElement.scrollHeight - window.innerHeight);

    // `behavior: 'instant'` is essential, not a detail. globals.css sets
    // `scroll-behavior: smooth` on <html> for anchor links; without the
    // override, every frame of this loop would start its own smooth scroll and
    // the result is slower and jerkier than doing nothing at all.
    const jump = (top) => window.scrollTo({ top, behavior: 'instant' });

    const tick = () => {
      const diff = target - window.scrollY;
      if (Math.abs(diff) < SETTLE) {
        jump(target);
        running = false;
        return;
      }
      jump(window.scrollY + diff * EASE);
      raf = requestAnimationFrame(tick);
    };

    /* The same easing, applied to one element's scrollTop. */
    const innerTick = () => {
      if (!innerEl) { innerRunning = false; return; }
      const diff = innerTarget - innerEl.scrollTop;
      if (Math.abs(diff) < SETTLE) {
        innerEl.scrollTop = innerTarget;
        innerRunning = false;
        return;
      }
      innerEl.scrollTop += diff * EASE;
      innerRaf = requestAnimationFrame(innerTick);
    };

    const onWheel = (e) => {
      if (e.ctrlKey || e.metaKey) return;             // pinch zoom
      if (e.deltaMode !== 0) return;                  // line/page mode: leave native
      const step = Math.max(-MAX_STEP, Math.min(MAX_STEP, e.deltaY));

      const el = innerScrollerAt(e.target);
      if (el) {
        const limit = el.scrollHeight - el.clientHeight;

        /* Scroll chaining, preserved.
         *
         * At the top scrolling up, or at the bottom scrolling down, the wheel
         * is handed back untouched so the page moves instead — which is what
         * the browser does natively. Swallowing it here would trap the reader
         * inside the panel, and a menu you cannot scroll out of is far worse
         * than one that steps. The 1px tolerance is for fractional scroll
         * positions produced by the easing itself. */
        const atTop = el.scrollTop <= 0 && step < 0;
        const atEnd = el.scrollTop >= limit - 1 && step > 0;
        if (atTop || atEnd) return;

        /* Re-reading scrollTop when idle keeps this in step with any other way
         * the element moved — a click that scrolled an item into view, a
         * keyboard arrow, a drag of its scrollbar. */
        if (el !== innerEl || !innerRunning) {
          innerEl = el;
          innerTarget = el.scrollTop;
        }
        e.preventDefault();
        innerTarget = Math.max(0, Math.min(limit, innerTarget + step));
        if (!innerRunning) { innerRunning = true; innerRaf = requestAnimationFrame(innerTick); }
        return;
      }

      e.preventDefault();
      target = Math.max(0, Math.min(maxScroll(), target + step));
      if (!running) { running = true; raf = requestAnimationFrame(tick); }
    };

    // Anything that moves the page by other means (anchor link, back-to-top,
    // keyboard, scrollbar) must reset the target, or the next wheel tick would
    // yank the reader back to where the animation thought they were.
    const resync = () => { if (!running) target = window.scrollY; };

    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('scroll', resync, { passive: true });
    window.addEventListener('resize', resync, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      /* The inner loop needs cancelling too, and innerEl released — holding a
       * reference to a detached node after a route change keeps its whole
       * subtree out of the garbage collector. */
      cancelAnimationFrame(innerRaf);
      innerEl = null;
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('scroll', resync);
      window.removeEventListener('resize', resync);
    };
  }, []);

  return null;
}
