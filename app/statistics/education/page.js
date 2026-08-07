'use client';
import { useEffect, useMemo, useState } from 'react';
import { School, Users, HandCoins, Landmark, MapPin, Layers, LayoutGrid, List, Images } from 'lucide-react';
import StatsShell, { BreakdownCard, statCard } from '@/components/stats/StatsShell';
import {
  KIND_LABEL, LEVEL_LABEL, SERVES_LABEL, SECTOR_LABEL,
  teachersPresent, pupilTeacherRatio, summarise,
} from '@/lib/institutions';
import InstitutionDetail from '@/components/stats/InstitutionDetail';
import { allPhotos } from '@/lib/gallery';
import { COLORS } from '@/lib/design/tokens';

/* Education statistics — the institutions register.
 *
 * The point of this page is the gap between what a school has on paper and
 * what it has in the classroom: teachers whose first-appointment posting is
 * this school, how many actually serve here, how many are on duty somewhere
 * else, and how many teachers the community has had to hire and pay for
 * itself. A single "number of teachers" figure would hide all of that.
 */
export default function EducationStatisticsPage() {
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [council, setCouncil] = useState('');
  const [village, setVillage] = useState('');
  const [kind, setKind] = useState('');
  const [view, setView] = useState('list');   // 'list' | 'gallery'
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    let off = false;
    fetch('/api/public/institutions', { cache: 'no-store' })
      .then(r => r.json())
      .then(j => {
        if (off) return;
        if (j?.ok) setD(j); else setErr(j?.message || 'Education data is unavailable right now.');
      })
      .catch(() => { if (!off) setErr('Education data is unavailable right now.'); })
      .finally(() => { if (!off) setLoading(false); });
    return () => { off = true; };
  }, []);

  const all = d?.institutions || [];
  const filtered = useMemo(() => all.filter(i =>
    (!council || i.union_council === council) &&
    (!village || i.village === village) &&
    (!kind || i.kind === kind)
  ), [all, council, village, kind]);

  const s = useMemo(() => summarise(filtered), [filtered]);
  const councils = useMemo(() => uniq(all.map(i => i.union_council)), [all]);
  const villages = useMemo(
    () => uniq(all.filter(i => !council || i.union_council === council).map(i => i.village)),
    [all, council]);

  return (
    <StatsShell
      title="Education Statistics"
      lead="Schools, colleges and training centres in Roundu — and the real staffing position at each one."
      caveat={<>
        <b>About these figures.</b> Each institution is recorded by TNR from local
        enquiry and official records, and shows where that information came from and
        when it was last checked. “Posted here” means a teacher whose first-appointment
        posting is that school; “serving elsewhere” means posted there on paper but on
        duty at another station.
      </>}
      loading={loading} error={err}
      empty={!loading && all.length === 0}
      emptyTitle="No institutions recorded yet"
      emptyMessage="Schools, colleges and training centres appear here once they are added in the admin panel."
    >
      {all.length > 0 && (
        <>
          {/* ── Filters ── */}
          <div className={statCard}>
            <div className="grid sm:grid-cols-3 gap-3">
              <Select label="Union Council" value={council}
                onChange={(v) => { setCouncil(v); setVillage(''); }}
                options={councils} allLabel="All Union Councils" />
              <Select label="Village / Area" value={village} onChange={setVillage}
                options={villages} allLabel="All villages" />
              <Select label="Type" value={kind} onChange={setKind} pairs
                options={Object.entries(KIND_LABEL).filter(([k]) => all.some(i => i.kind === k))}
                allLabel="All types" />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-[12px]" style={{ color: COLORS.muted }}>
              <span><b style={{ color: COLORS.green900 }}>{filtered.length}</b> of {all.length} institutions shown</span>
              {(council || village || kind) && (
                <button className="underline" style={{ color: COLORS.green700 }}
                  onClick={() => { setCouncil(''); setVillage(''); setKind(''); }}>Clear filters</button>
              )}
            </div>
          </div>

          {/* ── Institution counts ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
            <Big value={s.schools} label="Schools" />
            <Big value={s.colleges} label="Colleges" />
            <Big value={s.centres} label="Training Centres" />
            <Big value={s.students} label="Students Enrolled"
              sub={s.ratio ? `${s.ratio} students per teacher` : null} />
          </div>

          {/* ── The staffing gap ── */}
          <div className={statCard}>
            <div className="flex items-center gap-2.5 mb-1">
              <Users size={17} strokeWidth={2} aria-hidden="true" style={{ color: COLORS.green700 }} />
              <h2 className="font-extrabold" style={{ color: COLORS.green900 }}>Teaching Staff</h2>
            </div>
            <p className="mb-5 text-[12px]" style={{ color: COLORS.muted }}>
              On paper versus in the classroom.
            </p>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              <Cell value={s.sanctioned} label="Sanctioned posts" note="Approved by the department" />
              <Cell value={s.postedHere} label="Posted here" note="First-appointment station" />
              <Cell value={s.servingHere} label="Serving here" note="Of those posted, actually teaching" />
              <Cell value={s.servingElsewhere} label="Serving elsewhere" note="Posted here, on duty at another station" warn />
              <Cell value={s.attachedIn} label="Attached in" note="Posted elsewhere, teaching here" />
              <Cell value={s.communityTeachers} label="Community teachers" note="Hired and paid locally" gold />
            </div>

            <div className="mt-5 pt-5 border-t grid sm:grid-cols-2 gap-4" style={{ borderColor: COLORS.neutral }}>
              <Cell value={s.present} label="Teachers actually present" big
                note="Serving here + attached in + community teachers" />
              <Cell value={s.teachersNeeded} label="Additional teachers needed" big warn
                note="Shortfall reported by these institutions" />
            </div>
          </div>

          {/* ── What families pay ── */}
          {s.feeCharging > 0 && (
            <div className={statCard}>
              <div className="flex items-center gap-2.5 mb-1">
                <HandCoins size={17} strokeWidth={2} aria-hidden="true" style={{ color: COLORS.green700 }} />
                <h2 className="font-extrabold" style={{ color: COLORS.green900 }}>
                  Fees Charged for Community Teachers
                </h2>
              </div>
              <p className="mb-4 text-[12px]" style={{ color: COLORS.muted }}>
                Government institutions where families pay a monthly contribution to cover
                teachers the community has hired to fill a vacant post.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <Cell value={s.feeCharging} label="Institutions charging a fee" gold />
                <Cell value={`Rs ${s.feeAverage.toLocaleString()}`} label="Average monthly fee per student" gold />
              </div>
            </div>
          )}

          <AreaTable title="By Union Council" icon={Landmark} rows={s.byCouncil} />
          <AreaTable title="By Village / Area" icon={MapPin} rows={s.byVillage} />

          <div className="grid lg:grid-cols-2 gap-5">
            <BreakdownCard icon={Layers} title="By Level" note="Primary through degree." rows={s.byLevel} />
            <BreakdownCard icon={School} title="By Sector" note="Who runs the institution." rows={s.bySector} colorFrom={4} />
            <BreakdownCard icon={Users} title="Boys / Girls / Co-education" note="Who each institution serves." rows={s.byServes} colorFrom={8} />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-extrabold" style={{ color: COLORS.green900 }}>
              Institutions ({filtered.length})
            </h2>
            <div className="flex rounded-tnr overflow-hidden border" style={{ borderColor: 'rgba(10,61,44,.16)' }}>
              <ViewBtn on={view === 'list'} onClick={() => setView('list')} icon={List} label="List" />
              <ViewBtn on={view === 'gallery'} onClick={() => setView('gallery')} icon={LayoutGrid} label="Gallery" />
            </div>
          </div>

          {view === 'list'
            ? <InstitutionList list={filtered} onOpen={setOpenId} />
            : <InstitutionGallery list={filtered} onOpen={setOpenId} />}

          {openId && (
            <InstitutionDetail item={filtered.find(x => x.id === openId)}
              onClose={() => setOpenId(null)} />
          )}
        </>
      )}
    </StatsShell>
  );
}

const uniq = (l) => [...new Set(l.map(v => String(v || '').trim()).filter(Boolean))].sort();

function Select({ label, value, onChange, options, allLabel, pairs }) {
  return (
    <label className="block">
      <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: COLORS.muted }}>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-tnr border px-3 py-2 text-sm bg-white"
        style={{ borderColor: 'rgba(10,61,44,.16)', color: COLORS.charcoal }}>
        <option value="">{allLabel}</option>
        {options.map(o => pairs
          ? <option key={o[0]} value={o[0]}>{o[1]}</option>
          : <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}

function Big({ value, label, sub }) {
  return (
    <div className={statCard + ' text-center'}>
      <div className="text-3xl sm:text-4xl font-extrabold" style={{ color: COLORS.green900 }}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
      <div className="mt-1.5 text-[11px] font-bold uppercase tracking-wider" style={{ color: COLORS.muted }}>{label}</div>
      {sub && <div className="mt-1 text-[12px]" style={{ color: COLORS.muted }}>{sub}</div>}
    </div>
  );
}

/** One staffing figure. `warn` for gaps, `gold` for what the community funds. */
function Cell({ value, label, note, warn, gold, big }) {
  const colour = warn ? '#8A2F2F' : gold ? '#7A5C10' : COLORS.green900;
  return (
    <div className="rounded-tnr border p-4" style={{ borderColor: COLORS.neutral }}>
      <div className={`${big ? 'text-3xl' : 'text-2xl'} font-extrabold tabular-nums`} style={{ color: colour }}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
      <div className="mt-1 text-[12px] font-bold" style={{ color: COLORS.charcoal }}>{label}</div>
      {note && <div className="mt-0.5 text-[11px] leading-snug" style={{ color: COLORS.muted }}>{note}</div>}
    </div>
  );
}

function AreaTable({ title, icon: Icon, rows }) {
  if (!rows?.length) return null;
  return (
    <div className={statCard + ' overflow-x-auto'}>
      <div className="flex items-center gap-2.5 mb-4">
        <Icon size={17} strokeWidth={2} aria-hidden="true" style={{ color: COLORS.green700 }} />
        <h2 className="font-extrabold" style={{ color: COLORS.green900 }}>{title}</h2>
      </div>
      <table className="w-full text-[13px] min-w-[640px]">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wider" style={{ color: COLORS.muted }}>
            <th className="pb-2 font-bold">Area</th>
            <th className="pb-2 font-bold text-right">Institutions</th>
            <th className="pb-2 font-bold text-right">Sanctioned</th>
            <th className="pb-2 font-bold text-right">Present</th>
            <th className="pb-2 font-bold text-right">Elsewhere</th>
            <th className="pb-2 font-bold text-right">Community</th>
            <th className="pb-2 font-bold text-right">Needed</th>
            <th className="pb-2 font-bold text-right">Students</th>
          </tr>
        </thead>
        <tbody className="divide-y" style={{ borderColor: COLORS.neutral }}>
          {rows.map(r => (
            <tr key={r.label}>
              <td className="py-2.5 pr-3" style={{ color: COLORS.charcoal }}>{r.label}</td>
              <td className="py-2.5 text-right tabular-nums font-bold" style={{ color: COLORS.green900 }}>{r.count}</td>
              <td className="py-2.5 text-right tabular-nums" style={{ color: COLORS.muted }}>{r.sanctioned}</td>
              <td className="py-2.5 text-right tabular-nums font-bold" style={{ color: COLORS.green900 }}>{r.present}</td>
              <td className="py-2.5 text-right tabular-nums" style={{ color: r.elsewhere ? '#8A2F2F' : COLORS.muted }}>{r.elsewhere}</td>
              <td className="py-2.5 text-right tabular-nums" style={{ color: r.community ? '#7A5C10' : COLORS.muted }}>{r.community}</td>
              <td className="py-2.5 text-right tabular-nums" style={{ color: r.needed ? '#8A2F2F' : COLORS.muted }}>{r.needed}</td>
              <td className="py-2.5 text-right tabular-nums" style={{ color: COLORS.muted }}>{r.students.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const fmtDate = (d) => d ? new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : null;

function ViewBtn({ on, onClick, icon: Icon, label }) {
  return (
    <button onClick={onClick} aria-pressed={on}
      className="flex items-center gap-1.5 px-3.5 py-2 text-[13px] font-bold transition"
      style={{ background: on ? COLORS.green700 : '#fff', color: on ? '#fff' : COLORS.muted }}>
      <Icon size={15} strokeWidth={2.4} aria-hidden="true" />{label}
    </button>
  );
}

const NoMatch = () => (
  <div className={statCard + ' text-center text-[13px]'} style={{ color: COLORS.muted }}>
    No institutions match these filters.
  </div>
);

/* Photo-led grid. Institutions without a photo still appear as a green tile,
   so the gallery is never a partial, misleading subset of the register. */
function InstitutionGallery({ list, onOpen }) {
  if (!list.length) return <NoMatch />;
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {list.map(i => {
        const photos = allPhotos(i);
        const present = teachersPresent(i);
        return (
          <button key={i.id} onClick={() => onOpen(i.id)}
            className="text-left rounded-tnr-lg overflow-hidden bg-white shadow-tnr-flat border transition
              hover:shadow-tnr-raise hover:-translate-y-0.5"
            style={{ borderColor: 'rgba(200,154,43,.35)' }}>
            <div className="relative h-44 bg-tnr-neutral">
              {photos[0]
                ? <img src={photos[0]} alt="" className="h-full w-full object-cover" />
                : <div className="h-full w-full grid place-items-center px-4 text-center text-[13px] font-bold"
                    style={{ background: `linear-gradient(160deg,${COLORS.green800},${COLORS.green950})`, color: 'rgba(255,255,255,.75)' }}>
                    {i.name}
                  </div>}
              {photos.length > 1 && (
                <span className="absolute top-2.5 right-2.5 flex items-center gap-1 px-2 py-1 rounded-full
                  text-[11px] font-bold text-white" style={{ background: 'rgba(6,45,33,.72)' }}>
                  <Images size={12} strokeWidth={2.5} aria-hidden="true" />{photos.length}
                </span>
              )}
            </div>
            <div className="p-4">
              <h3 className="font-bold text-[14px] leading-snug" style={{ color: COLORS.green900 }}>{i.name}</h3>
              <div className="mt-1 text-[12px]" style={{ color: COLORS.muted }}>
                {[LEVEL_LABEL[i.level], i.village || i.union_council].filter(Boolean).join(' · ')}
              </div>
              <div className="mt-2 text-[12px]" style={{ color: COLORS.muted }}>
                <b style={{ color: COLORS.green900 }}>{present}</b> teachers present
                {i.students_total > 0 && <> · {i.students_total.toLocaleString()} students</>}
              </div>
              <span className="mt-3 inline-block text-[12px] font-bold underline" style={{ color: COLORS.green700 }}>
                View school profile
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function InstitutionList({ list, onOpen }) {
  if (!list.length) return <NoMatch />;
  return (
    <div className={statCard}>
      <ul className="space-y-4">
        {list.map(i => {
          const present = teachersPresent(i);
          const ratio = pupilTeacherRatio(i);
          const short = Number(i.teachers_needed) || 0;
          return (
            <li key={i.id} className="rounded-tnr border p-4" style={{ borderColor: COLORS.neutral }}>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h3 className="font-bold text-[14px]" style={{ color: COLORS.green900 }}>{i.name}</h3>
                <span className="text-[12px]" style={{ color: COLORS.muted }}>
                  {[LEVEL_LABEL[i.level], SERVES_LABEL[i.serves], SECTOR_LABEL[i.sector],
                    [i.village, i.union_council].filter(Boolean).join(', ')].filter(Boolean).join(' · ')}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[12px]" style={{ color: COLORS.muted }}>
                <Fact label="Sanctioned" value={i.sanctioned_posts} />
                <Fact label="Posted here" value={i.posted_here} />
                <Fact label="Serving here" value={i.serving_here} />
                {i.serving_elsewhere > 0 && <Fact label="Serving elsewhere" value={i.serving_elsewhere} tone="#8A2F2F" />}
                {i.attached_in > 0 && <Fact label="Attached in" value={i.attached_in} />}
                {i.community_teachers > 0 && <Fact label="Community teachers" value={i.community_teachers} tone="#7A5C10" />}
                <Fact label="Present" value={present} />
                {short > 0 && <Fact label="Needed" value={short} tone="#8A2F2F" />}
                {i.students_total > 0 && <Fact label="Students" value={i.students_total.toLocaleString()} />}
                {ratio && <Fact label="Per teacher" value={ratio} />}
              </div>

              {Number(i.community_fee_monthly) > 0 && (
                <div className="mt-3 rounded-tnr px-3.5 py-2.5 text-[12px]"
                  style={{ background: 'rgba(200,154,43,.10)', color: '#7A5C10' }}>
                  Families pay <b>Rs {Number(i.community_fee_monthly).toLocaleString()}</b> per student
                  per month towards community teachers.
                  {i.fee_note && <> {i.fee_note}</>}
                </div>
              )}

              {i.elsewhere_note && (
                <div className="mt-2.5 rounded-tnr px-3.5 py-2.5 text-[12px] leading-relaxed"
                  style={{ background: 'rgba(170,60,60,.08)', color: '#8A2F2F' }}>
                  <b>Posted here, serving elsewhere:</b> {i.elsewhere_note}
                </div>
              )}

              {i.notes && (
                <p className="mt-2.5 text-[13px] leading-relaxed" style={{ color: COLORS.charcoal }}>{i.notes}</p>
              )}

              {(i.source || i.last_verified) && (
                <div className="mt-2.5 pt-2.5 border-t text-[11px]" style={{ borderColor: COLORS.neutral, color: COLORS.muted }}>
                  {i.source && <>Source: {i.source}</>}
                  {i.source && i.last_verified && ' · '}
                  {i.last_verified && <>Last checked {fmtDate(i.last_verified)}</>}
                </div>
              )}

              <div className="mt-3 flex items-center gap-3">
                <button onClick={() => onOpen(i.id)}
                  className="text-[12px] font-bold underline" style={{ color: COLORS.green700 }}>
                  View school profile
                </button>
                {allPhotos(i).length > 0 && (
                  <span className="flex items-center gap-1 text-[11px]" style={{ color: COLORS.muted }}>
                    <Images size={12} strokeWidth={2.5} aria-hidden="true" />
                    {allPhotos(i).length} photo{allPhotos(i).length === 1 ? '' : 's'}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const Fact = ({ label, value, tone }) => (
  <span>{label}: <b style={{ color: tone || COLORS.charcoal }}>{value}</b></span>
);
