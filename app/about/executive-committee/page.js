'use client';
import DocPage, { Section, P, TickList, Callout, C } from '@/components/site/DocPage';
import { CEC_ROLE, CEC_POSITIONS, CEC_NOTE, CORE_LEADERSHIP_CRITERIA } from '@/content/aboutTnr';
import ExecutiveCard from '@/components/site/ExecutiveCard';
import { useLeadership } from '@/components/site/useLeadership';

export default function ExecutiveCommitteePage() {
  const { executive } = useLeadership();
  return (
    <DocPage eyebrow="Governance" title="Central Executive Committee"
      lead="The principal executive body of TNR."
      source="TNR Governance Handbook — Constitution Article VII, and Chapter 4, Clauses 4.2–4.3.">

      <Section title="Role"><P>{CEC_ROLE}</P></Section>

      <Section title="Committee Members">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {executive.map(m => <ExecutiveCard key={m.slug} member={m} />)}
        </div>
      </Section>

      <Section title="Composition">
        <P>The CEC comprises the following positions:</P>
        <div className="grid sm:grid-cols-2 gap-3">
          {CEC_POSITIONS.map((p, i) => (
            <div key={p} className="rounded-xl border border-gray-200 p-4 flex items-center gap-3">
              <span className="shrink-0 w-7 h-7 rounded-lg grid place-items-center text-[12px] font-black text-white"
                style={{ background: C.green }}>{i + 1}</span>
              <span className="font-bold text-[15px]" style={{ color: C.deep }}>{p}</span>
            </div>
          ))}
        </div>
        <div className="mt-5"><Callout label="Note">{CEC_NOTE}</Callout></div>
      </Section>

      <Section title="Core Leadership Criteria">
        <P>To be eligible for any core leadership position, a candidate must:</P>
        <TickList items={CORE_LEADERSHIP_CRITERIA} />
      </Section>

      <Section title="Meetings and Quorum">
        <TickList items={[
          'A quorum for meetings of the CEC, UCC, and VGC shall consist of a simple majority (50% plus one) of the total membership of the respective body. No decision, resolution, or action shall be valid in the absence of a quorum.',
          'The President shall preside at all meetings. In the absence of the President, the Vice President shall preside.',
          'Where both the President and Vice President are absent, the members present and constituting a quorum shall elect an Acting Chairperson from amongst themselves for that meeting only.',
        ]} />
      </Section>

      <Section title="Terms of Office">
        <TickList items={[
          'All elected and appointed office-bearers of the CEC, UCC and VGC shall hold office for a term of one (1) year.',
          'The first six (6) months of every term shall constitute a probationary period during which the performance and conduct of the office-bearer may be reviewed by ADC.',
          'No person shall hold the same office within the CEC, UCC or VGC for more than two (2) terms, whether consecutive or non-consecutive.',
        ]} />
      </Section>
    </DocPage>
  );
}
