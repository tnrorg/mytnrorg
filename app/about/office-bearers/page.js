'use client';
import DocPage, { Section, P, TickList, Callout, C } from '@/components/site/DocPage';
import UcCoordinatorCallout from '@/components/site/UcCoordinatorCallout';
import { OFFICE_BEARERS, OTHER_OFFICE_BEARERS, CORE_LEADERSHIP_CRITERIA } from '@/content/aboutTnr';

export default function OfficeBearersPage() {
  return (
    <DocPage eyebrow="Governance" title="Office Bearers"
      lead="Eligibility criteria and responsibilities for each leadership position."
      source="TNR Governance Handbook — Chapter 4, Clauses 4.4–4.11.">

      {/* At the top, and only while a call is actually open.
       *
       * Someone reading the eligibility criteria for a leadership position is
       * the single most likely person on the site to want to apply for one —
       * so the invitation belongs here, above the criteria they are about to
       * measure themselves against, rather than buried after them. */}
      <UcCoordinatorCallout />

      <Section title="General Requirements">
        <P>Every office bearer must first meet the core leadership criteria:</P>
        <TickList items={CORE_LEADERSHIP_CRITERIA} />
      </Section>

      <Section title="Position-Specific Criteria">
        <P>In addition to the general criteria above, each position carries its own requirements.</P>
        <div className="space-y-4">
          {OFFICE_BEARERS.map(([role, items]) => (
            <div key={role} className="rounded-2xl border border-gray-200 p-5">
              <h3 className="font-black text-[16px] mb-3" style={{ color: C.deep }}>{role}</h3>
              <TickList items={items} />
            </div>
          ))}
        </div>
      </Section>

      <Callout label="Other Office-Bearers">{OTHER_OFFICE_BEARERS}</Callout>
    </DocPage>
  );
}
