'use client';
import DocPage, { Section, P, TickList, C, sectionId } from '@/components/site/DocPage';
import { GOVERNANCE_INTRO, GOVERNANCE_TIERS, REPORTING_LINES, GOVERNING_DOCUMENTS } from '@/content/aboutTnr';

export default function GovernancePage() {
  const toc = [
    { id: sectionId('Governance Tiers'), title: 'Governance Tiers' },
    { id: sectionId('Reporting Lines and Coordination Framework'), title: 'Reporting Lines and Coordination Framework' },
    { id: sectionId('Governing Documents'), title: 'Governing Documents' },
  ];

  return (
    <DocPage toc={toc} eyebrow="Governance" title="Governance Structure"
      lead="How TNR is organised, from the Advisory Council down to Village Committees."
      source="TNR Governance Handbook, Part III — Governance Structure, Chapter 3.">

      <Section><P>{GOVERNANCE_INTRO}</P></Section>

      <Section title="Governance Tiers">
        <div className="space-y-3">
          {GOVERNANCE_TIERS.map(([name, abbr, desc]) => (
            <div key={name} className="rounded-2xl border border-gray-200 p-5">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="font-black text-[16px]" style={{ color: C.deep }}>{name}</span>
                {abbr && <span className="text-[11px] font-bold px-2 py-0.5 rounded-md"
                  style={{ background: '#F3E4B3', color: C.deep }}>{abbr}</span>}
              </div>
              <div className="text-[14px] leading-relaxed text-gray-600">{desc}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Reporting Lines and Coordination Framework">
        <P>The governance framework of TNR shall operate through a structured system of reporting, coordination, and institutional oversight.</P>
        <TickList items={REPORTING_LINES} />
      </Section>

      <Section title="Governing Documents">
        <P>The following documents form part of the governance framework of TNR. In the event of inconsistency, the Constitution shall prevail.</P>
        <TickList items={GOVERNING_DOCUMENTS} />
      </Section>
    </DocPage>
  );
}
