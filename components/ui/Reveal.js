'use client';
import { useSyncExternalStore } from 'react';
import { motion } from 'framer-motion';
import {
  revealUp, revealUpMobile, staggerChildren, MOBILE_STAGGER,
  imageReveal, imageRevealMobile,
} from '@/lib/design/tokens';

/* ── Scroll reveals ───────────────────────────────────────────────────────────
 *
 * `tnr-reveal` ON EVERY ONE OF THEM IS LOAD-BEARING. Framer server-renders the
 * `hidden` variant, so each of these ships with an inline `opacity:0`. If
 * JavaScript never runs, nothing sets it back and the page is blank. The
 * <noscript> rule in app/layout.js targets this class to force the content
 * visible, and an inline style can only be overridden by !important.
 *
 * Reduced motion is handled once, globally, by MotionProvider — NOT by the
 * CSS block in globals.css, which cannot touch Framer's JS-driven inline
 * styles however many !importants it carries.
 */

/* Is this a phone-sized viewport?
 *
 * useSyncExternalStore rather than useEffect + useState: the server snapshot
 * is false, so the markup React renders on the server and the markup it
 * renders on the first client pass agree, and there is no hydration mismatch.
 * The value corrects itself before paint on a real phone.
 *
 * One listener shared by every Reveal on the page, because the store is
 * created once at module scope — not one matchMedia per animated element. */
const MOBILE_Q = '(max-width: 767px)';
let mql = null;
const getMql = () => {
  if (typeof window === 'undefined') return null;
  if (!mql) mql = window.matchMedia(MOBILE_Q);
  return mql;
};
const subscribe = (cb) => {
  const m = getMql();
  if (!m) return () => {};
  m.addEventListener('change', cb);
  return () => m.removeEventListener('change', cb);
};
const getSnapshot = () => !!getMql()?.matches;
const getServerSnapshot = () => false;

export const useIsPhone = () =>
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

/** Fades a section up as it scrolls into view — once, not on every pass. */
export function Reveal({ children, className = '', delay = 0, as = 'div' }) {
  const M = motion[as] || motion.div;
  /* A shorter trip and a quicker settle on a phone. The desktop 32px travel
     over 0.7s reads as elegant on a wide screen and as sluggish on a small
     one, where the element has far less distance to cover before it is fully
     in view — and where the device is likeliest to be the slowest. */
  const phone = useIsPhone();
  const base = phone ? revealUpMobile : revealUp;

  return (
    // `margin` rather than `amount`: requiring 20% of a tall section to be on
    // screen meant it only started animating once it was already well up the
    // page, so the reader saw the tail end. Pulling the trigger line 12% up
    // from the bottom edge starts the reveal as the section rises into view.
    <M className={`tnr-reveal ${className}`} initial="hidden" whileInView="show"
      viewport={{ once: true, margin: '0px 0px -12% 0px' }}
      variants={{ ...base, show: { ...base.show, transition: { ...base.show.transition, delay } } }}>
      {children}
    </M>
  );
}

/** Wrap a list so its children reveal in sequence rather than all at once. */
export function RevealGroup({ children, className = '', gap }) {
  const phone = useIsPhone();
  /* Tighter stagger on a phone. A 0.09s gap down a column of eight cards is
     0.72s before the last one starts, and on a narrow screen the reader has
     usually scrolled past it by then — so the card they are looking at is the
     one still waiting its turn. */
  const step = gap ?? (phone ? MOBILE_STAGGER : 0.10);

  return (
    <motion.div className={`tnr-reveal ${className}`} initial="hidden" whileInView="show"
      viewport={{ once: true, margin: '0px 0px -10% 0px' }} variants={staggerChildren(step)}>
      {children}
    </motion.div>
  );
}

/* A photograph settling into place as it scrolls in.
 *
 * A wrapper rather than an <Image> replacement, so it works with next/image
 * `fill`, with a plain <img>, and with the placeholder tile a card shows when
 * there is no photo — and so it cannot interfere with sizes, loading or the
 * aspect-ratio box that keeps the layout from shifting.
 *
 * `overflow-hidden` is applied here, not left to the caller: the hidden
 * variant scales to 1.03, and without clipping the picture pushes over its
 * own rounded corner for the length of the animation. */
export function RevealImage({ children, className = '' }) {
  const phone = useIsPhone();
  return (
    <motion.div className={`tnr-reveal overflow-hidden ${className}`}
      initial="hidden" whileInView="show"
      viewport={{ once: true, margin: '0px 0px -8% 0px' }}
      variants={phone ? imageRevealMobile : imageReveal}>
      {children}
    </motion.div>
  );
}

export function RevealItem({ children, className = '' }) {
  const phone = useIsPhone();
  return (
    <motion.div className={`tnr-reveal ${className}`}
      variants={phone ? revealUpMobile : revealUp}>
      {children}
    </motion.div>
  );
}
