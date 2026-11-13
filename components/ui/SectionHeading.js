'use client';
import { motion } from 'framer-motion';
import { FONT, COLORS, MOTION } from '@/lib/design/tokens';
import { useIsPhone } from './Reveal';

/* One heading treatment for every section, so type hierarchy stops drifting
 * page to page. `as` keeps the heading level semantically correct.
 *
 * IT ARRIVES IN SEQUENCE, not as one block. As the heading scrolls into view:
 *
 *   1. the eyebrow fades up,
 *   2. the title rises out from behind an invisible edge (it starts just below
 *      its own line box, which clips it — so it appears to be lifted into
 *      place rather than faded in),
 *   3. the description follows,
 *   4. the gold rule draws itself from its anchor.
 *
 * The four steps overlap; the whole thing is done in about a second and a
 * half and never holds the reader up, because nothing below it waits for it.
 *
 * WHY EACH ANIMATED PART CARRIES `tnr-reveal`. Framer server-renders the
 * hidden state inline. Without JavaScript nothing would ever undo it — and the
 * title, sitting below its clip, would be not faint but entirely absent. The
 * <noscript> rule in app/layout.js targets this class and forces opacity and
 * transform back. Do not remove the class from any of them.
 *
 * The heading text itself is ordinary text inside the real <h2>. Nothing is
 * split into letters or duplicated, so search engines and screen readers read
 * exactly what they read before.
 *
 * Callers should NOT also wrap this in <Reveal>: two fades multiplied together
 * make the sequence look like a smear.
 */
const EASE = MOTION.easeOut;

const partVariants = (phone) => {
  // A phone gets the same order of events, compressed: less distance to
  // travel on a small screen, and the slowest devices are phones.
  const k = phone ? 0.7 : 1;
  return {
    eyebrow: {
      hidden: { opacity: 0, y: phone ? 8 : 14 },
      show: { opacity: 1, y: 0, transition: { duration: 0.8 * k, ease: EASE } },
    },
    title: {
      hidden: { y: '108%' },
      show: { y: '0%', transition: { duration: 1.15 * k, delay: 0.09 * k, ease: EASE } },
    },
    lead: {
      hidden: { opacity: 0, y: phone ? 8 : 16 },
      show: { opacity: 1, y: 0, transition: { duration: 0.9 * k, delay: 0.26 * k, ease: EASE } },
    },
    rule: {
      hidden: { scaleX: 0, opacity: 0 },
      show: { scaleX: 1, opacity: 1, transition: { duration: 0.9 * k, delay: 0.36 * k, ease: EASE } },
    },
  };
};

export default function SectionHeading({
  eyebrow, title, lead, align = 'left', as: Tag = 'h2', tone = 'dark', className = '',
}) {
  const center = align === 'center';
  const light = tone === 'light';
  const v = partVariants(useIsPhone());

  return (
    <motion.div data-heading=""
      className={`${center ? 'text-center mx-auto max-w-2xl' : 'max-w-2xl'} ${className}`} style={FONT}
      initial="hidden" whileInView="show"
      viewport={{ once: true, margin: '0px 0px -12% 0px' }}>
      {eyebrow && (
        <motion.div data-part="eyebrow" variants={v.eyebrow}
          className="tnr-reveal text-[11px] sm:text-xs font-bold uppercase tracking-[.18em]"
          style={{ color: light ? COLORS.gold400 : COLORS.green700 }}>{eyebrow}</motion.div>
      )}

      <Tag className="mt-2 text-[26px] sm:text-[34px] lg:text-[40px] font-extrabold leading-[1.12] tracking-[-0.02em]"
        style={{ color: light ? '#fff' : COLORS.green900 }}>
        {/* The clip. The padding/negative-margin pair gives descenders (g, y,
            the tail of an Urdu letter) room inside the clip without moving
            anything on the page. */}
        <span className="block overflow-hidden pb-[0.14em] -mb-[0.14em]">
          <motion.span data-part="title" variants={v.title}
            className="tnr-reveal block">{title}</motion.span>
        </span>
      </Tag>

      {lead && (
        <motion.p data-part="lead" variants={v.lead}
          className="tnr-reveal mt-3 text-sm sm:text-[15px] leading-relaxed"
          style={{ color: light ? 'rgba(255,255,255,.68)' : COLORS.muted }}>{lead}</motion.p>
      )}

      <motion.div data-part="rule" variants={v.rule} aria-hidden="true"
        className={`tnr-reveal mt-4 h-[2px] w-12 ${center ? 'mx-auto origin-center' : 'origin-left'}`}
        style={{ background: COLORS.gold500 }} />
    </motion.div>
  );
}
