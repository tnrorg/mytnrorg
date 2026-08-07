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
 *   • A wheel over a scrollable element (a dialog, a table, a long dropdown)
 *     is left alone, so inner scrolling still works.
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

    /** True when the wheel is over something that scrolls on its own. */
    const overInnerScroller = (el) => {
      for (let n = el; n && n !== document.body; n = n.parentElement) {
        const s = getComputedStyle(n);
        if (/(auto|scroll)/.test(s.overflowY) && n.scrollHeight > n.clientHeight + 1) return true;
      }
      return false;
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

    const onWheel = (e) => {
      if (e.ctrlKey || e.metaKey) return;             // pinch zoom
      if (e.deltaMode !== 0) return;                  // line/page mode: leave native
      if (overInnerScroller(e.target)) return;

      e.preventDefault();
      const step = Math.max(-MAX_STEP, Math.min(MAX_STEP, e.deltaY));
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
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('scroll', resync);
      window.removeEventListener('resize', resync);
    };
  }, []);

  return null;
}
