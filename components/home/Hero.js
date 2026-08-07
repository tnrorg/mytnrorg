'use client';
import { motion } from 'framer-motion';
import { ArrowRight, Mountain } from 'lucide-react';
import { COLORS, FONT, MOTION } from '@/lib/design/tokens';

/* Abstract "community connections" motif — soft lines and nodes suggesting
   people linked across the valley. Purely decorative, drawn once on entry
   rather than looping, and hidden from assistive tech. */
function ConnectionsMotif() {
  const nodes = [
    [18, 62], [34, 40], [50, 68], [66, 34], [82, 56], [26, 84], [72, 82], [58, 16],
  ];
  const links = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [2, 6], [3, 7], [1, 7], [4, 6]];
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"
      className="absolute inset-0 w-full h-full pointer-events-none">
      {links.map(([a, b], i) => (
        <motion.line key={i}
          x1={nodes[a][0]} y1={nodes[a][1]} x2={nodes[b][0]} y2={nodes[b][1]}
          stroke={COLORS.green700} strokeWidth=".18" strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 0.22 }}
          transition={{ duration: 1.1, delay: 0.25 + i * 0.07, ease: MOTION.ease }} />
      ))}
      {nodes.map(([x, y], i) => (
        <motion.circle key={i} cx={x} cy={y} r=".7" fill={COLORS.gold500}
          initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 0.5 }}
          transition={{ duration: 0.4, delay: 0.5 + i * 0.06, ease: MOTION.ease }} />
      ))}
    </svg>
  );
}

export default function Hero() {
  const fade = (delay) => ({
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: MOTION.reveal, delay, ease: MOTION.ease },
  });

  return (
    <section className="relative overflow-hidden" style={FONT}>
      <div className="absolute inset-0" aria-hidden="true">
        <img src="/hero.jpg" alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0" style={{
          background: `linear-gradient(100deg,${COLORS.snow} 0%,rgba(248,250,248,.95) 40%,rgba(248,250,248,.6) 60%,rgba(248,250,248,.15) 80%)`,
        }} />
        <ConnectionsMotif />
      </div>

      <div className="relative max-w-tnr-wide mx-auto px-4 py-16 lg:py-24 grid lg:grid-cols-[1.15fr,0.85fr] gap-10 items-center">
        <div>
          <motion.div {...fade(0)}
            className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[.14em]"
            style={{ background: 'rgba(23,107,73,.10)', color: COLORS.green700 }}>
            <Mountain size={13} strokeWidth={2.5} aria-hidden="true" />
            Roundu · Gilgit-Baltistan
          </motion.div>

          <motion.h1 {...fade(0.08)}
            className="mt-4 text-[2.1rem] sm:text-5xl lg:text-[3.4rem] font-extrabold leading-[1.06] tracking-tight uppercase"
            style={{ color: COLORS.green900 }}>
            Empowering Youth.<br />Strengthening Roundu.
          </motion.h1>

          <motion.p {...fade(0.16)} className="mt-5 max-w-xl text-[15px] leading-relaxed"
            style={{ color: COLORS.muted }}>
            TNR connects the youth, professionals, volunteers, and communities of Roundu
            to promote education, leadership, service, and sustainable development.
          </motion.p>

          <motion.div {...fade(0.24)} className="mt-8 flex flex-wrap gap-3">
            <a href="/membership/apply"
              className="group inline-flex items-center gap-2 rounded-tnr px-6 py-3.5 font-bold text-white
                shadow-tnr-raise transition-transform duration-micro hover:-translate-y-[2px]"
              style={{ background: `linear-gradient(180deg,${COLORS.green700},${COLORS.green900})` }}>
              Join TNR
              <ArrowRight size={17} strokeWidth={2.5} aria-hidden="true"
                className="transition-transform duration-micro group-hover:translate-x-0.5" />
            </a>
            <a href="/about"
              className="inline-flex items-center gap-2 rounded-tnr px-6 py-3.5 font-bold bg-white
                border transition-colors duration-micro hover:bg-tnr-neutral"
              style={{ borderColor: 'rgba(10,61,44,.14)', color: COLORS.green900 }}>
              Explore Our Work
            </a>
          </motion.div>
        </div>

        {/* Value pillars — replaces the old "under development" placeholder. */}
        <motion.div {...fade(0.3)} className="rounded-tnr-xl p-7 text-white shadow-tnr-raise"
          style={{ background: `linear-gradient(165deg,${COLORS.green800},${COLORS.green950})`,
                   border: '1px solid rgba(200,154,43,.30)' }}>
          <div className="text-[11px] font-bold uppercase tracking-[.16em]" style={{ color: COLORS.gold400 }}>
            What We Stand For
          </div>
          <div className="mt-1.5 h-[2px] w-10" style={{ background: COLORS.gold500 }} />
          <ul className="mt-5 space-y-4">
            {[
              ['Education', 'Scholarships, guidance and learning for every student.'],
              ['Leadership', 'Preparing the next generation to lead with vision.'],
              ['Service', 'Welfare and volunteer work rooted in our villages.'],
              ['Unity', 'One community across Roundu and beyond.'],
            ].map(([t, d]) => (
              <li key={t} className="flex gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: COLORS.gold500 }} />
                <div>
                  <div className="text-sm font-bold">{t}</div>
                  <div className="text-[12.5px] leading-snug" style={{ color: 'rgba(255,255,255,.62)' }}>{d}</div>
                </div>
              </li>
            ))}
          </ul>
        </motion.div>
      </div>
    </section>
  );
}
