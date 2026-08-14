'use client';
import { GraduationCap, Briefcase, Users, HeartHandshake, Landmark, MapPin } from 'lucide-react';
import StatsShell, { BigStat, BreakdownCard } from '@/components/stats/StatsShell';
import { useRounduStats } from '@/components/stats/useRounduStats';
import MembershipGeography from '@/components/stats/MembershipGeography';

/* The overview page: every membership breakdown in one place.
 *
 * Education and Employment have their own pages with more detail; this stays
 * the single view for anyone who wants the whole picture at once. All three
 * read the same endpoint, so their totals cannot disagree.
 */
const SECTIONS = [
  ['education',     'Education Levels',       GraduationCap,  'Highest qualification recorded by members.'],
  ['professions',   'Professions',            Briefcase,      'What members do today.'],
  ['fieldOfStudy',  'Fields of Study',        GraduationCap,  'Subjects members studied.'],
  ['contribution',  'Contribution Interests', HeartHandshake, 'Where members want to help. Members may choose several.'],
  ['unionCouncils', 'By Union Council',       Landmark,       'Members grouped by Union Council.'],
  ['villages',      'By Village / Area',      MapPin,         'Members grouped by village.'],
  ['gender',        'Gender',                 Users,          'Recorded at registration.'],
];

export default function StatisticsPage() {
  const { d, err, loading } = useRounduStats();

  return (
    <StatsShell
      title="TNR Membership in Numbers"
      lead="Every figure on this page is calculated live from TNR membership records."
      caveat={<>
        <b>About these figures.</b> They describe TNR’s registered members — not the population
        of Roundu. District statistics such as population, literacy rate and tourism come from
        official government sources and will be published separately as they are gathered.
      </>}
      loading={loading} error={err}
      empty={!!d && d.total === 0}
      emptyTitle="No member statistics yet"
      emptyMessage="Figures appear here once memberships are approved."
    >
      {d && d.total > 0 && (
        <>
          <BigStat value={d.total} label="Active Members" />

          {/* Where those members are. Renders nothing until there is data, so
              the page is unchanged for an empty database. */}
          <MembershipGeography />

          <div className="grid lg:grid-cols-2 gap-5">
            {/* `id` and scroll-mt: the home page's figures link straight to the
                section they summarise (/statistics#unionCouncils), and the
                margin stops the sticky header covering the heading on arrival. */}
            {SECTIONS.map(([k, title, Icon, note], i) => (
              <div key={k} id={k} className="scroll-mt-24">
                <BreakdownCard icon={Icon} title={title} note={note}
                  rows={d[k]} colorFrom={i * 4} />
              </div>
            ))}
          </div>
        </>
      )}
    </StatsShell>
  );
}
