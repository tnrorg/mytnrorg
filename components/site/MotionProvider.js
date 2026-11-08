'use client';
import { MotionConfig } from 'framer-motion';

/* Makes every Framer Motion animation on the site respect the reader's
 * "reduce motion" setting.
 *
 * THIS IS A BUG FIX, NOT A NEW FEATURE.
 *
 * globals.css already carries the usual reduced-motion block, and Reveal.js
 * carried a comment claiming motion users "get the static result via the
 * global CSS override". That claim was wrong. The CSS block sets
 * `animation-duration` and `transition-duration` to 0.01ms, which only
 * governs animations CSS is driving. Framer Motion does not use CSS
 * transitions — it writes transform and opacity to the element's inline
 * style on every frame from JavaScript — so the override never touched it.
 * Someone who had asked their operating system to reduce motion was still
 * getting every card flying up the page, on every section of the site.
 *
 * `reducedMotion="user"` is Framer's own handling: when the setting is on it
 * drops transform-based animation (the movement that actually causes
 * discomfort) and keeps opacity, so content still arrives gently rather than
 * snapping. Nothing is hidden and no layout changes.
 *
 * It wraps children rather than being imported into each component, so a
 * section added later is covered without anyone remembering to opt in.
 *
 * Being a client component does NOT drag the tree client-side: children are
 * passed through as already-rendered React nodes, so the server components
 * inside app/page.js stay server components.
 */
export default function MotionProvider({ children }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
