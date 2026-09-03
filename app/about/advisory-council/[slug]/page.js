'use client';;
import { use } from "react";
import DocPage, { Section, P, C } from '@/components/site/DocPage';
import { CouncilPhoto } from '@/components/site/CouncilCard';
import { bySlug } from '@/content/advisoryCouncil';
import { useLeadership } from '@/components/site/useLeadership';

export default function CouncilMemberPage(props) {
  const params = use(props.params);
  const { advisory } = useLeadership();
  const m = advisory.find(x => x.slug === params?.slug) || bySlug(params?.slug);

  if (!m) {
    return (
      <DocPage eyebrow="Advisory Council" title="Member not found"
        lead="This profile is not available." source="Interim Advisory Council, Tehreek-e-Nojawanan Roundu.">
        <a href="/about/advisory-council" className="font-bold" style={{ color: C.green }}>← Back to the Advisory Council</a>
      </DocPage>
    );
  }

  const others = advisory.filter(x => x.slug !== m.slug);

  return (
    <DocPage eyebrow="Interim Advisory Council" title={m.name}
      lead={[m.degree, m.field && `(${m.field})`].filter(Boolean).join(' ')}
      source="Interim Advisory Council, Tehreek-e-Nojawanan Roundu.">

      <div className="flex flex-col sm:flex-row gap-7 mb-10">
        <CouncilPhoto member={m} size="large" />
        <div className="min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-[.2em] mb-1" style={{ color: C.gold }}>Affiliation</div>
          <p className="text-[16px] font-semibold leading-relaxed" style={{ color: C.deep }}>{m.affiliation}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {(m.expertise || []).map(e => (
              <span key={e} className="text-[12px] font-semibold px-3 py-1.5 rounded-lg"
                style={{ background: '#0B6B4F14', color: C.green }}>{e}</span>
            ))}
          </div>
        </div>
      </div>

      <Section title="Interests & Expertise">
        <div className="grid sm:grid-cols-2 gap-3">
          {(m.expertise || []).map(e => (
            <div key={e} className="rounded-xl border border-gray-200 px-4 py-3 text-[14px] font-semibold" style={{ color: C.deep }}>{e}</div>
          ))}
        </div>
      </Section>

      <Section title="Role on the Council">
        <P>
          As a member of the Interim Advisory Council, {m.name} contributes to the strategic guidance
          and oversight of Tehreek-e-Nojawanan Roundu — providing mentorship, safeguarding the
          integrity and continuity of the organisation, and promoting merit-based leadership.
        </P>
      </Section>

      <Section title="Other Council Members">
        <div className="flex flex-wrap gap-2">
          {others.map(o => (
            <a key={o.slug} href={`/about/advisory-council/${o.slug}`}
              className="text-[13px] font-semibold px-3 py-2 rounded-xl border border-gray-200 hover:border-[#0B6B4F] transition"
              style={{ color: C.deep }}>{o.name}</a>
          ))}
        </div>
        <div className="mt-5">
          <a href="/about/advisory-council" className="text-[14px] font-bold" style={{ color: C.green }}>
            ← Back to the Advisory Council
          </a>
        </div>
      </Section>
    </DocPage>
  );
}
