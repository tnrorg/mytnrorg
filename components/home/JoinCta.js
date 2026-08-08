'use client';
import { ArrowRight, HeartHandshake } from 'lucide-react';
import { Reveal } from '@/components/ui';
import { COLORS, FONT } from '@/lib/design/tokens';

export default function JoinCta() {
  return (
    <section className="max-w-tnr-wide mx-auto px-4 pb-20 w-full" style={FONT}>
      <Reveal>
        <div className="tnr-ring-gold rounded-tnr-xl px-6 sm:px-12 py-14 text-center relative overflow-hidden"
          style={{
            background: `linear-gradient(140deg,${COLORS.green800},${COLORS.green950})`,
            boxShadow: '0 2px 6px rgba(6,45,33,.08), 0 30px 70px -18px rgba(6,45,33,.45)',
          }}>
          {/* Two static accents on opposing corners. A single blob reads as a
              stray artefact; a balanced pair reads as intentional lighting. */}
          <div aria-hidden="true" className="absolute -top-24 -right-16 w-72 h-72 rounded-full"
            style={{ background: 'radial-gradient(circle,rgba(200,154,43,.18),transparent 68%)' }} />
          <div aria-hidden="true" className="absolute -bottom-28 -left-20 w-80 h-80 rounded-full"
            style={{ background: 'radial-gradient(circle,rgba(23,107,73,.30),transparent 70%)' }} />
          {/* Top bevel highlight — the same trick as .tnr-sheen, in white. */}
          <div aria-hidden="true" className="absolute inset-x-0 top-0 h-px"
            style={{ background: 'linear-gradient(90deg,transparent,rgba(255,255,255,.35),transparent)' }} />
          <div className="relative">
            <h2 className="text-2xl sm:text-[2rem] font-extrabold leading-snug text-white max-w-2xl mx-auto">
              Together, We Can Build a Better Future for Roundu.
            </h2>
            <div className="mx-auto mt-5 h-[2px] w-14" style={{ background: COLORS.gold500 }} />
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <a href="/membership/apply"
                className="group inline-flex items-center gap-2 rounded-tnr px-6 py-3.5 font-bold
                  transition-transform duration-micro hover:-translate-y-[2px]"
                style={{ background: `linear-gradient(180deg,${COLORS.gold400},${COLORS.gold500})`, color: COLORS.green950 }}>
                Become a Member
                <ArrowRight size={17} strokeWidth={2.5} aria-hidden="true"
                  className="transition-transform duration-micro group-hover:translate-x-0.5" />
              </a>
              <a href="/volunteer"
                className="inline-flex items-center gap-2 rounded-tnr px-6 py-3.5 font-bold text-white
                  border transition-colors duration-micro hover:bg-white/10"
                style={{ borderColor: 'rgba(255,255,255,.28)' }}>
                <HeartHandshake size={17} strokeWidth={2.2} aria-hidden="true" />
                Volunteer With TNR
              </a>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
