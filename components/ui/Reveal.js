'use client';
import { motion } from 'framer-motion';
import { revealUp, staggerChildren } from '@/lib/design/tokens';

/** Fades a section up as it scrolls into view — once, not on every pass.
 *  Reduced-motion users get the static result via the global CSS override. */
export function Reveal({ children, className = '', delay = 0, as = 'div' }) {
  const M = motion[as] || motion.div;
  return (
    // `margin` rather than `amount`: requiring 20% of a tall section to be on
    // screen meant it only started animating once it was already well up the
    // page, so the reader saw the tail end. Pulling the trigger line 12% up
    // from the bottom edge starts the reveal as the section rises into view.
    <M className={className} initial="hidden" whileInView="show"
      viewport={{ once: true, margin: '0px 0px -12% 0px' }}
      variants={{ ...revealUp, show: { ...revealUp.show, transition: { ...revealUp.show.transition, delay } } }}>
      {children}
    </M>
  );
}

/** Wrap a list so its children reveal in sequence rather than all at once. */
export function RevealGroup({ children, className = '', gap = 0.06 }) {
  return (
    <motion.div className={className} initial="hidden" whileInView="show"
      viewport={{ once: true, margin: '0px 0px -10% 0px' }} variants={staggerChildren(gap)}>
      {children}
    </motion.div>
  );
}
export const RevealItem = ({ children, className = '' }) => (
  <motion.div className={className} variants={revealUp}>{children}</motion.div>
);
