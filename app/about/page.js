'use client';
import DocPage, { Section, P, TickList, Callout, C } from '@/components/site/DocPage';
import { WHO_WE_ARE, WHAT_WE_DO, GUIDING_PRINCIPLES, MOTTO, CORE_VALUES, FOREWORD } from '@/content/aboutTnr';

export default function AboutPage() {
  return (
    <DocPage eyebrow="About TNR" title="Tehreek-e-Nojawanan Roundu" lead={MOTTO}>
      <Section title="Who We Are"><P>{WHO_WE_ARE}</P></Section>

      <Section title="What We Do">
        <P>TNR seeks to:</P>
        <TickList items={WHAT_WE_DO} />
      </Section>

      <Section title="Guiding Principles">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {GUIDING_PRINCIPLES.map(p => (
            <div key={p} className="rounded-xl border border-gray-200 px-4 py-4 text-center font-bold text-[14px]"
              style={{ color: C.deep }}>{p}</div>
          ))}
        </div>
      </Section>

      <Section title="Core Values">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {CORE_VALUES.map(([ur, en]) => (
            <div key={en} className="rounded-2xl p-5 text-center text-white" style={{ background: C.deep }}>
              <div className="text-2xl mb-1" style={{ fontFamily: "'Noto Nastaliq Urdu', serif", lineHeight: 1.8 }}>{ur}</div>
              <div className="text-[11px] font-bold uppercase tracking-[.2em]" style={{ color: C.gold }}>{en}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Message from the Advisory Council" kicker="Foreword">
        {FOREWORD.map((para, i) => <P key={i}>{para}</P>)}
        <Callout label="Advisory Council">Tehreek-e-Nojawanan Roundu (TNR) — June 2026</Callout>
      </Section>
    </DocPage>
  );
}
