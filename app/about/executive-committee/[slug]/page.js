'use client';;
import { use } from "react";
import DocPage, { Section, TickList, C } from '@/components/site/DocPage';
import { ExecutivePhoto } from '@/components/site/ExecutiveCard';
import { execBySlug } from '@/content/executiveCommittee';
import { useLeadership } from '@/components/site/useLeadership';

export default function ExecutiveMemberPage(props) {
  const params = use(props.params);
  const { executive } = useLeadership();
  const m = executive.find(x => x.slug === params?.slug) || execBySlug(params?.slug);

  if (!m) {
    return (
      <DocPage eyebrow="Executive Committee" title="Position not found"
        lead="This profile is not available."
        source="Central Executive Committee, Tehreek-e-Nojawanan Roundu.">
        <a href="/about/executive-committee" className="font-bold" style={{ color: C.green }}>← Back to the Executive Committee</a>
      </DocPage>
    );
  }

  const named = !!m.name;
  const others = executive.filter(x => x.slug !== m.slug);

  return (
    <DocPage eyebrow="Central Executive Committee" title={m.designation} lead={m.summary}
      source="TNR Governance Handbook — Constitution Article VII, and Chapter 4.">

      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-7 mb-10">
        <ExecutivePhoto member={m} size="large" />
        <div className="min-w-0 text-center sm:text-left">
          <div className="text-[11px] font-bold uppercase tracking-[.2em] mb-1" style={{ color: C.gold }}>Office Holder</div>
          <p className="text-[20px] font-black leading-tight" style={{ color: named ? C.deep : '#9CA3AF' }}>
            {named ? m.name : 'To Be Announced'}
          </p>
          {/* Profession first, matching the cards; the degree stands in when
              no profession is recorded. The generic "term of office" line that
              used to sit here was identical on every profile, so it told the
              reader nothing about the individual — it belongs on the
              Executive Committee page, where it still appears. */}
          {(m.profession || m.qualification) && (
            <p className="mt-1 text-[15px] font-semibold" style={{ color: C.green }}>
              {m.profession || m.qualification}
            </p>
          )}
          {(m.organisation || m.country) && (
            <p className="mt-1 text-[13.5px] text-gray-500">
              {[m.organisation, m.country].filter(Boolean).join(' · ')}
            </p>
          )}

          {/* This page describes the OFFICE. Everything the person entered in
              their own portal — biography, education, experience, publications,
              skills, gallery — lives on their professional profile, so link to
              it rather than duplicating a partial copy here. */}
          {named && (
            <a href={`/council/${m.slug}`}
              className="mt-4 inline-block text-[13px] font-bold py-2.5 px-5 rounded-xl text-white transition hover:opacity-90"
              style={{ background: C.deep }}>
              View full professional profile →
            </a>
          )}
        </div>
      </div>

      {!!(m.duties || []).length && <Section title="Responsibilities"><TickList items={m.duties} /></Section>}

      <Section title="Other Committee Positions">
        <div className="flex flex-wrap gap-2">
          {others.map(o => (
            <a key={o.slug} href={`/about/executive-committee/${o.slug}`}
              className="text-[13px] font-semibold px-3 py-2 rounded-xl border border-gray-200 hover:border-[#0B6B4F] transition"
              style={{ color: C.deep }}>{o.designation}</a>
          ))}
        </div>
        <div className="mt-5">
          <a href="/about/executive-committee" className="text-[14px] font-bold" style={{ color: C.green }}>
            ← Back to the Executive Committee
          </a>
        </div>
      </Section>
    </DocPage>
  );
}
