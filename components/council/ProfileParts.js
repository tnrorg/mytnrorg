'use client';
import { motion } from 'framer-motion';
import { COLORS, FONT, MOTION } from '@/lib/design/tokens';

/* Shared building blocks for the council profile. Kept in one file so every
   section shares identical spacing, radius and type — the audit found the
   opposite pattern (29 files each inventing their own). */

export const glass = 'rounded-tnr-lg border border-gray-100 bg-white/80 backdrop-blur-sm shadow-tnr-flat';

/** A profile section. Renders nothing when empty, so a member who has not
 *  filled in a section does not get an empty heading on their public page. */
export function Section({ id, title, count, children, empty = false }) {
  if (empty) return null;
  return (
    <motion.section id={id} style={FONT} className="scroll-mt-24"
      initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: MOTION.reveal, ease: MOTION.ease }}>
      <div className="flex items-baseline gap-3">
        <h2 className="text-xl font-extrabold tracking-tight" style={{ color: COLORS.green900 }}>{title}</h2>
        {count > 0 && (
          <span className="rounded-full px-2 py-0.5 text-[11px] font-bold"
            style={{ background: COLORS.neutral, color: COLORS.muted }}>{count}</span>
        )}
      </div>
      <div className="mt-1.5 h-[2px] w-10" style={{ background: COLORS.gold500 }} />
      <div className="mt-6">{children}</div>
    </motion.section>
  );
}

/** Vertical timeline used for education and experience. */
export function Timeline({ children }) {
  return <ol className="relative space-y-6 pl-7">
    <span aria-hidden="true" className="absolute left-[7px] top-1.5 bottom-1.5 w-px"
      style={{ background: 'linear-gradient(180deg,rgba(200,154,43,.5),rgba(23,107,73,.18))' }} />
    {children}
  </ol>;
}

export function TimelineItem({ heading, sub, meta, children, current }) {
  return (
    <motion.li className="relative"
      initial={{ opacity: 0, x: -8 }} whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }} transition={{ duration: MOTION.standard, ease: MOTION.ease }}>
      <span aria-hidden="true"
        className="absolute -left-7 top-1.5 grid place-items-center w-[15px] h-[15px] rounded-full"
        style={{ background: '#fff', border: `2px solid ${current ? COLORS.gold500 : COLORS.green700}` }}>
        {current && <span className="w-1.5 h-1.5 rounded-full" style={{ background: COLORS.gold500 }} />}
      </span>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h3 className="font-bold text-[15px]" style={{ color: COLORS.charcoal }}>{heading}</h3>
        {meta && <span className="text-[12px] tabular-nums shrink-0" style={{ color: COLORS.muted }}>{meta}</span>}
      </div>
      {sub && <div className="text-[13px] mt-0.5" style={{ color: COLORS.green700 }}>{sub}</div>}
      {children && <div className="mt-1.5 text-[13px] leading-relaxed" style={{ color: COLORS.muted }}>{children}</div>}
    </motion.li>
  );
}

/** Animated skill / expertise tag. */
export function Tag({ children, i = 0, tone = 'green' }) {
  const s = tone === 'gold'
    ? { background: 'rgba(200,154,43,.12)', color: '#7A5C10' }
    : { background: 'rgba(23,107,73,.08)', color: COLORS.green700 };
  return (
    <motion.span className="rounded-full px-3 py-1.5 text-[12.5px] font-semibold"
      style={s}
      initial={{ opacity: 0, scale: 0.92 }} whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ duration: MOTION.standard, delay: Math.min(i * 0.03, 0.4), ease: MOTION.ease }}>
      {children}
    </motion.span>
  );
}

export const yearRange = (a, b, current) =>
  current ? `${a || ''} — Present` : [a, b].filter(Boolean).join(' — ') || null;
