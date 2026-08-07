'use client';
import DocPage, { Section, P, TickList, Callout, C, sectionId } from '@/components/site/DocPage';
import { CONDUCT_APPLICABILITY, CONDUCT_STANDARDS, CONFLICT_OF_INTEREST, DISCIPLINARY_MEASURES, DISCIPLINARY_NOTES } from '@/content/aboutTnr';

export default function CodeOfConductPage() {
  const toc = [
    { id: sectionId('General Applicability'), title: 'General Applicability' },
    { id: sectionId('Standards of Conduct'), title: 'Standards of Conduct' },
    { id: sectionId('Conflict of Interest'), title: 'Conflict of Interest' },
    { id: sectionId('Disciplinary Action'), title: 'Disciplinary Action' },
  ];

  return (
    <DocPage toc={toc} eyebrow="Ethics & Conduct" title="Code of Conduct"
      lead="The standards of conduct expected of every member of TNR."
      source="TNR Governance Handbook, Part IV — Ethics & Conduct, Chapter 5.">

      <Section title="General Applicability"><P>{CONDUCT_APPLICABILITY}</P></Section>

      <Section title="Standards of Conduct">
        <div className="space-y-4">
          {CONDUCT_STANDARDS.map(([title, body], i) => (
            <div key={title} className="rounded-2xl border border-gray-200 p-5">
              <div className="flex items-start gap-3">
                <span className="shrink-0 w-7 h-7 rounded-lg grid place-items-center text-[12px] font-black text-white"
                  style={{ background: C.green }}>{i + 1}</span>
                <div>
                  <h3 className="font-black text-[15px] mb-1.5" style={{ color: C.deep }}>{title}</h3>
                  <p className="text-[14px] leading-[1.8] text-gray-700">{body}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Conflict of Interest"><TickList items={CONFLICT_OF_INTEREST} /></Section>

      <Section title="Disciplinary Action">
        <P>Where a violation of this Code is established, the EGC may impose one or more of the following measures:</P>
        <div className="flex flex-wrap gap-2 mb-5">
          {DISCIPLINARY_MEASURES.map(m => (
            <span key={m} className="text-[13px] font-semibold px-3 py-2 rounded-xl border border-gray-200"
              style={{ color: C.deep }}>{m}</span>
          ))}
        </div>
        <TickList items={DISCIPLINARY_NOTES} />
      </Section>

      <Callout label="Amendments and Review">
        This Code of Conduct may be reviewed, amended, or expanded from time to time to address evolving
        organisational needs, governance requirements, and emerging circumstances, subject to the approval of the ADC.
      </Callout>
    </DocPage>
  );
}
