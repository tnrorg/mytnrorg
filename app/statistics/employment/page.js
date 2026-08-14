'use client';
import { Briefcase, Users, HeartHandshake } from 'lucide-react';
import StatsShell, { BigStat, BreakdownCard } from '@/components/stats/StatsShell';
import { useRounduStats } from '@/components/stats/useRounduStats';

/* Employment statistics, computed live from TNR membership records.
 *
 * The application form asks for a current position, not an employment status,
 * so members who left it blank appear as "Not stated" rather than being
 * counted as unemployed. Reporting an unemployment rate from this data would
 * be inventing a number the form never collected.
 */
export default function EmploymentStatisticsPage() {
  const { d, err, loading } = useRounduStats();

  const working = d?.employmentStatus?.find(g => g.label === 'In work or self-employed')?.count || 0;
  const studying = d?.employmentStatus?.find(g => g.label === 'Studying')?.count || 0;

  return (
    <StatsShell
      title="Employment Statistics"
      lead="What TNR's registered members do — professions, study, and where they want to contribute."
      caveat={<>
        <b>About these figures.</b> They describe TNR’s registered members — not the
        workforce of Roundu. The form asks for a current position, not an employment
        status, so members who left it blank are shown as “Not stated”; this page does
        not report an unemployment rate, because that was never asked.
      </>}
      loading={loading} error={err}
      empty={!!d && d.total === 0}
      emptyTitle="No employment statistics yet"
      emptyMessage="Figures appear here once memberships are approved."
    >
      {d && (
        <>
          <div className="grid sm:grid-cols-3 gap-5">
            <BigStat value={d.total} label="Active Members" />
            <BigStat value={working} label="In Work or Self-Employed"
              sub={d.total ? `${Math.round((working / d.total) * 100)}% of members` : null} />
            <BigStat value={studying} label="Currently Studying"
              sub={d.total ? `${Math.round((studying / d.total) * 100)}% of members` : null} />
          </div>

          {/* Anchors so the home page figures land on the chart they summarise.
              Both "Students" and "Professionals" are derived from the current
              position each member recorded, which is what these two show. */}
          <div className="grid lg:grid-cols-2 gap-5">
            <div id="work-or-study" className="scroll-mt-24">
              <BreakdownCard icon={Users} title="Work or Study"
                note="Based on the current position each member recorded."
                rows={d.employmentStatus} />
            </div>
            <div id="professions" className="scroll-mt-24">
              <BreakdownCard icon={Briefcase} title="Professions"
                note="What members do today." colorFrom={3}
                rows={d.professions} />
            </div>
            <BreakdownCard icon={HeartHandshake} title="Contribution Interests"
              note="Where members want to help. Members may choose several, so these add up to more than 100%."
              colorFrom={8} rows={d.contribution} />
          </div>
        </>
      )}
    </StatsShell>
  );
}
