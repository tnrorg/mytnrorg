'use client';
import DocPage, { Section, P, Callout, C, sectionId } from '@/components/site/DocPage';
import { VISION, MISSION, STRATEGIC_PRIORITIES, MANIFESTO } from '@/content/aboutTnr';

export default function VisionMissionPage() {
  const toc = [
    { id: sectionId('Vision'), title: 'Vision' },
    { id: sectionId('Mission'), title: 'Mission' },
    { id: sectionId('Strategic Priorities'), title: 'Strategic Priorities' },
    { id: sectionId('Manifesto'), title: 'Manifesto' },
  ];

  return (
    <DocPage toc={toc} eyebrow="Our Identity" title="Vision, Mission & Manifesto"
      source="TNR Governance Handbook, Part I — Organisational Identity, Chapter 1.">
      <Section title="Vision">
        <div className="rounded-2xl p-6 sm:p-8 text-white" style={{ background: C.deep }}>
          <div className="text-xl sm:text-2xl font-black leading-snug">{VISION}</div>
        </div>
      </Section>

      <Section title="Mission"><P>{MISSION}</P></Section>

      <Section title="Strategic Priorities">
        <div className="grid sm:grid-cols-2 gap-3">
          {STRATEGIC_PRIORITIES.map(([name, sdg], i) => (
            <div key={name} className="rounded-xl border border-gray-200 p-4 flex items-start gap-3">
              <span className="shrink-0 w-7 h-7 rounded-lg grid place-items-center text-[12px] font-black text-white"
                style={{ background: C.green }}>{i + 1}</span>
              <div>
                <div className="font-bold text-[15px]" style={{ color: C.deep }}>{name}</div>
                <div className="text-[12px] font-semibold" style={{ color: C.gold }}>{sdg}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Manifesto">
        <div className="space-y-5">
          {MANIFESTO.map(([title, body], i) => (
            <div key={title}>
              <h3 className="font-black text-[16px] mb-2" style={{ color: C.deep }}>{i + 1}. {title}</h3>
              <P>{body}</P>
            </div>
          ))}
        </div>
      </Section>
    </DocPage>
  );
}
