'use client';
import DocPage, { C } from '@/components/site/DocPage';
import { CONSTITUTION } from '@/content/aboutTnr';

const slug = (a) => a.replace(/\s+/g, '-').toLowerCase();

export default function ConstitutionPage() {
  // Feeds the sticky rail in DocPage — one source for both the links and the
  // section ids, so they cannot drift apart.
  const toc = CONSTITUTION.map(a => ({ id: slug(a.article), kicker: a.article, title: a.title }));

  return (
    <DocPage toc={toc} eyebrow="Governance" title="Constitution of TNR"
      lead="The supreme governance document of Tehreek-e-Nojawanan Roundu. Where any inconsistency arises between governance documents, this Constitution shall prevail."
      source="TNR Governance Handbook, Part II — Constitution, Chapter 2, Articles I–XV.">


      {CONSTITUTION.map(a => (
        <section key={a.article} id={slug(a.article)} className="mb-11 scroll-mt-24">
          <div className="text-[11px] font-bold uppercase tracking-[.22em] mb-1" style={{ color: C.gold }}>{a.article}</div>
          <h2 className="text-xl sm:text-2xl font-black mb-4" style={{ color: C.deep }}>{a.title}</h2>
          <div className="space-y-3">
            {a.clauses.map(([no, text], i) => (
              <div key={i} className="flex gap-3">
                {no
                  ? <span className="shrink-0 text-[12px] font-bold tabular-nums pt-[3px] w-12" style={{ color: C.green }}>{no}</span>
                  : <span className="shrink-0 w-12" />}
                <p className="text-[15px] leading-[1.85] text-gray-700">{text}</p>
              </div>
            ))}
          </div>
        </section>
      ))}
    </DocPage>
  );
}
