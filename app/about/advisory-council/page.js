'use client';
import CouncilDirectory from '@/components/council/CouncilDirectory';
import DocPage, { Section, P, TickList, Callout, C } from '@/components/site/DocPage';
import { COUNCIL_TAGLINE, COUNCIL_MISSION } from '@/content/advisoryCouncil';
import { ADC_INTRO, ADC_CRITERIA, ADC_DUTIES, ADC_FACTS, EGC } from '@/content/aboutTnr';

export default function AdvisoryCouncilPage() {
  return (
    <DocPage eyebrow="Governance" title="Advisory Council"
      lead="The strategic advisory and oversight body of TNR."
      source="TNR Governance Handbook — Constitution Article V and Article VI, and Chapter 4, Clause 4.1.">

      <Section title="Role"><P>{ADC_INTRO}</P></Section>

      <Section title="Interim Advisory Council" kicker={COUNCIL_TAGLINE}>
        <CouncilDirectory />
        <div className="mt-6"><Callout label="Our Collective Mission">{COUNCIL_MISSION}</Callout></div>
      </Section>

      <Section title="At a Glance">
        <div className="rounded-2xl border border-gray-200 overflow-hidden">
          {ADC_FACTS.map(([k, v], i) => (
            <div key={k} className={`grid sm:grid-cols-[190px_1fr] gap-1 sm:gap-4 p-4 ${i ? 'border-t border-gray-200' : ''}`}>
              <div className="text-[13px] font-bold uppercase tracking-wide" style={{ color: C.deep }}>{k}</div>
              <div className="text-[14px] leading-relaxed text-gray-700">{v}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Responsibilities">
        <P>The ADC shall:</P>
        <TickList items={ADC_DUTIES} />
      </Section>

      <Section title="Eligibility Criteria">
        <P>Advisory Council members must:</P>
        <TickList items={ADC_CRITERIA} />
      </Section>

      <Section title="Ethics and Grievances Committee">
        <TickList items={EGC} />
      </Section>

      <Callout label="Oversight and Accountability">
        The Advisory Council shall exercise oversight over all office-bearers and committees of the
        Organisation, including the CEC and the UCC. No office bearer shall be exempt from
        accountability under the Constitution.
      </Callout>
    </DocPage>
  );
}
