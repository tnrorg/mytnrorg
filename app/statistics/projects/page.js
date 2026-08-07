'use client';
import { useEffect, useMemo, useState } from 'react';
import { Landmark, MapPin, Tag, Building2, LayoutGrid, List, Images } from 'lucide-react';
import StatsShell, { BreakdownCard, statCard } from '@/components/stats/StatsShell';
import ProjectDetail from '@/components/stats/ProjectDetail';
import {
  PROJECT_STATUSES, STATUS_LABEL, STATUS_TONE, money, exactMoney, summarise, allPhotos,
} from '@/lib/projects';
import { COLORS } from '@/lib/design/tokens';

/* Development projects tracker — public accountability view.
 *
 * Every figure is entered by an administrator from an official source, and
 * each project carries that source and the date it was last checked. Nothing
 * here is derived, estimated or filled in: an unknown cost shows as blank
 * rather than zero, because a zero would read as "nothing was spent".
 */
export default function ProjectStatisticsPage() {
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [council, setCouncil] = useState('');
  const [village, setVillage] = useState('');
  const [status, setStatus] = useState('');
  const [view, setView] = useState('list');   // 'list' | 'gallery'
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    let off = false;
    fetch('/api/public/projects', { cache: 'no-store' })
      .then(r => r.json())
      .then(j => {
        if (off) return;
        if (j?.ok) setD(j); else setErr(j?.message || 'Project data is unavailable right now.');
      })
      .catch(() => { if (!off) setErr('Project data is unavailable right now.'); })
      .finally(() => { if (!off) setLoading(false); });
    return () => { off = true; };
  }, []);

  const all = d?.projects || [];
  const cfg = d?.settings || {};
  const cur = cfg.currency || 'PKR';

  // Filtering happens here rather than server-side: the whole list is already
  // loaded, so re-querying for a village would be a round trip for nothing.
  const filtered = useMemo(() => all.filter(p =>
    (!council || p.union_council === council) &&
    (!village || p.village === village) &&
    (!status || p.status === status)
  ), [all, council, village, status]);

  const s = useMemo(() => summarise(filtered), [filtered]);
  const councils = useMemo(() => uniq(all.map(p => p.union_council)), [all]);
  const villages = useMemo(
    () => uniq(all.filter(p => !council || p.union_council === council).map(p => p.village)),
    [all, council]);

  const filtering = !!(council || village || status);

  return (
    <StatsShell
      eyebrow="Roundu Statistics"
      title={cfg.page_title || 'Development Projects'}
      lead={cfg.page_intro || 'Development schemes recorded for Roundu — approval stage, cost and progress, village by village.'}
      caveat={<>
        <b>About these figures.</b>{' '}
        {cfg.source_note
          || 'Each project below is recorded from official sources and shows where that information came from and when it was last checked. Figures are as notified by the relevant department, not independently audited.'}
      </>}
      loading={loading} error={err}
      empty={!loading && all.length === 0}
      emptyTitle="No projects recorded yet"
      emptyMessage="Projects appear here once they are added in the admin panel."
    >
      {all.length > 0 && (
        <>
          {(cfg.representative_name || cfg.constituency) && (
            <div className={statCard}>
              <div className="text-[11px] font-bold uppercase tracking-[.16em]" style={{ color: COLORS.green700 }}>
                {cfg.constituency || 'Constituency'}
              </div>
              {cfg.representative_name && (
                <div className="mt-1 text-lg font-extrabold" style={{ color: COLORS.green900 }}>
                  {cfg.representative_name}
                  {cfg.representative_title && (
                    <span className="ml-2 text-[12px] font-semibold" style={{ color: COLORS.muted }}>
                      {cfg.representative_title}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Filters ── */}
          <div className={statCard}>
            <div className="grid sm:grid-cols-3 gap-3">
              <Select label="Union Council" value={council}
                onChange={(v) => { setCouncil(v); setVillage(''); }}
                options={councils} allLabel="All Union Councils" />
              <Select label="Village / Area" value={village} onChange={setVillage}
                options={villages} allLabel="All villages" />
              <Select label="Stage" value={status} onChange={setStatus}
                options={PROJECT_STATUSES.filter(([k]) => all.some(p => p.status === k)).map(([k, l]) => [k, l])}
                allLabel="All stages" pairs />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-[12px]" style={{ color: COLORS.muted }}>
              <span><b style={{ color: COLORS.green900 }}>{filtered.length}</b> of {all.length} projects shown</span>
              {filtering && (
                <button className="underline" style={{ color: COLORS.green700 }}
                  onClick={() => { setCouncil(''); setVillage(''); setStatus(''); }}>
                  Clear filters
                </button>
              )}
            </div>
          </div>

          {/* ── Headline numbers ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
            <Money label="Total Approved Cost" value={s.approvedCost} cur={cur} />
            <Money label="Funds Released" value={s.releasedFunds} cur={cur}
              sub={s.approvedCost ? `${Math.round((s.releasedFunds / s.approvedCost) * 100)}% of approved` : null} />
            <Count label="Completed" value={s.completed} total={s.total} />
            <Count label="Ongoing" value={s.ongoing} total={s.total} />
          </div>

          <Pipeline stats={s} cur={cur} />

          {/* ── Area tables — the part residents actually come for ── */}
          <AreaTable title="By Union Council" icon={Landmark} rows={s.byCouncil} cur={cur} />
          <AreaTable title="By Village / Area" icon={MapPin} rows={s.byVillage} cur={cur} />

          <div className="grid lg:grid-cols-2 gap-5">
            <BreakdownCard icon={Tag} title="By Sector" note="What kind of work has been sanctioned."
              rows={s.byCategory} colorFrom={4} />
            <BreakdownCard icon={Building2} title="By Department" note="Which department is responsible."
              rows={s.byDepartment} colorFrom={9} />
          </div>

          {/* ── List / gallery ── */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-extrabold" style={{ color: COLORS.green900 }}>
              Projects ({filtered.length})
            </h2>
            <div className="flex rounded-tnr overflow-hidden border" style={{ borderColor: 'rgba(10,61,44,.16)' }}>
              <ViewBtn on={view === 'list'} onClick={() => setView('list')} icon={List} label="List" />
              <ViewBtn on={view === 'gallery'} onClick={() => setView('gallery')} icon={LayoutGrid} label="Gallery" />
            </div>
          </div>

          {view === 'list'
            ? <ProjectList projects={filtered} cur={cur} onOpen={setOpenId} />
            : <ProjectGallery projects={filtered} cur={cur} onOpen={setOpenId} />}

          {openId && (
            <ProjectDetail cur={cur} onClose={() => setOpenId(null)}
              project={filtered.find(p => p.id === openId)} />
          )}
        </>
      )}
    </StatsShell>
  );
}

function ViewBtn({ on, onClick, icon: Icon, label }) {
  return (
    <button onClick={onClick} aria-pressed={on}
      className="flex items-center gap-1.5 px-3.5 py-2 text-[13px] font-bold transition"
      style={{ background: on ? COLORS.green700 : '#fff', color: on ? '#fff' : COLORS.muted }}>
      <Icon size={15} strokeWidth={2.4} aria-hidden="true" />{label}
    </button>
  );
}

const uniq = (list) => [...new Set(list.map(v => String(v || '').trim()).filter(Boolean))].sort();

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

function Money({ label, value, cur, sub }) {
  return (
    <div className={statCard + ' text-center'}>
      <div className="text-2xl sm:text-3xl font-extrabold" style={{ color: COLORS.green900 }}
        title={exactMoney(value, cur)}>
        {money(value, cur)}
      </div>
      <div className="mt-1.5 text-[11px] font-bold uppercase tracking-wider" style={{ color: COLORS.muted }}>{label}</div>
      {sub && <div className="mt-1 text-[12px]" style={{ color: COLORS.muted }}>{sub}</div>}
    </div>
  );
}

function Count({ label, value, total }) {
  return (
    <div className={statCard + ' text-center'}>
      <div className="text-3xl sm:text-4xl font-extrabold" style={{ color: COLORS.green900 }}>{value}</div>
      <div className="mt-1.5 text-[11px] font-bold uppercase tracking-wider" style={{ color: COLORS.muted }}>{label}</div>
      {total > 0 && <div className="mt-1 text-[12px]" style={{ color: COLORS.muted }}>
        {Math.round((value / total) * 100)}% of {total}
      </div>}
    </div>
  );
}

/** The approval pipeline, in stage order rather than sorted by size. */
function Pipeline({ stats, cur }) {
  if (!stats.byStatus.length) return null;
  return (
    <div className={statCard}>
      <h2 className="font-extrabold" style={{ color: COLORS.green900 }}>Approval &amp; Delivery Stages</h2>
      <p className="mt-1 mb-4 text-[12px]" style={{ color: COLORS.muted }}>
        Shown in the order a scheme moves through, not by size.
      </p>
      <div className="flex h-3 rounded-full overflow-hidden" style={{ background: COLORS.neutral }}>
        {stats.byStatus.map(st => (
          <div key={st.key} style={{ width: `${st.percent}%`, background: STATUS_TONE[st.key]?.fg || COLORS.green700 }}
            title={`${st.label}: ${st.count}`} />
        ))}
      </div>
      <ul className="mt-4 grid sm:grid-cols-2 gap-2.5">
        {stats.byStatus.map(st => (
          <li key={st.key} className="flex items-center justify-between gap-3 text-[13px]">
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ background: STATUS_TONE[st.key]?.fg || COLORS.green700 }} aria-hidden="true" />
              <span style={{ color: COLORS.charcoal }}>{st.label}</span>
            </span>
            <span className="tabular-nums shrink-0" style={{ color: COLORS.muted }}>
              <b style={{ color: COLORS.green900 }}>{st.count}</b>
              {st.cost > 0 && <> · <span title={exactMoney(st.cost, cur)}>{money(st.cost, cur)}</span></>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AreaTable({ title, icon: Icon, rows, cur }) {
  if (!rows?.length) return null;
  return (
    <div className={statCard + ' overflow-x-auto'}>
      <div className="flex items-center gap-2.5 mb-4">
        <Icon size={17} strokeWidth={2} aria-hidden="true" style={{ color: COLORS.green700 }} />
        <h2 className="font-extrabold" style={{ color: COLORS.green900 }}>{title}</h2>
      </div>
      <table className="w-full text-[13px] min-w-[560px]">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wider" style={{ color: COLORS.muted }}>
            <th className="pb-2 font-bold">Area</th>
            <th className="pb-2 font-bold text-right">Projects</th>
            <th className="pb-2 font-bold text-right">Completed</th>
            <th className="pb-2 font-bold text-right">Ongoing</th>
            <th className="pb-2 font-bold text-right">Pending</th>
            <th className="pb-2 font-bold text-right">Approved Cost</th>
            <th className="pb-2 font-bold text-right">Released</th>
          </tr>
        </thead>
        <tbody className="divide-y" style={{ borderColor: COLORS.neutral }}>
          {rows.map(r => (
            <tr key={r.label}>
              <td className="py-2.5 pr-3" style={{ color: COLORS.charcoal }}>{r.label}</td>
              <td className="py-2.5 text-right tabular-nums font-bold" style={{ color: COLORS.green900 }}>{r.count}</td>
              <td className="py-2.5 text-right tabular-nums" style={{ color: COLORS.muted }}>{r.completed}</td>
              <td className="py-2.5 text-right tabular-nums" style={{ color: COLORS.muted }}>{r.ongoing}</td>
              <td className="py-2.5 text-right tabular-nums" style={{ color: COLORS.muted }}>{r.pending}</td>
              <td className="py-2.5 text-right tabular-nums" style={{ color: COLORS.charcoal }}
                title={exactMoney(r.approved_cost, cur)}>{money(r.approved_cost, cur)}</td>
              <td className="py-2.5 text-right tabular-nums" style={{ color: COLORS.muted }}
                title={exactMoney(r.released_funds, cur)}>{money(r.released_funds, cur)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const fmtDate = (d) => d ? new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : null;

/* Photo-led grid. Projects without a photo still appear — as a green tile with
   the title — so the gallery is never a partial, misleading subset. */
function ProjectGallery({ projects, cur, onOpen }) {
  if (!projects.length) return <NoMatch />;
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {projects.map(p => {
        const photos = allPhotos(p);
        const tone = STATUS_TONE[p.status] || {};
        return (
          <button key={p.id} onClick={() => onOpen(p.id)}
            className="text-left rounded-tnr-lg overflow-hidden bg-white shadow-tnr-flat border transition
              hover:shadow-tnr-raise hover:-translate-y-0.5"
            style={{ borderColor: 'rgba(200,154,43,.35)' }}>
            <div className="relative h-44 bg-tnr-neutral">
              {photos[0]
                ? <img src={photos[0]} alt="" className="h-full w-full object-cover" />
                : <div className="h-full w-full grid place-items-center px-4 text-center text-[13px] font-bold"
                    style={{ background: `linear-gradient(160deg,${COLORS.green800},${COLORS.green950})`, color: 'rgba(255,255,255,.75)' }}>
                    {p.title}
                  </div>}
              {photos.length > 1 && (
                <span className="absolute top-2.5 right-2.5 flex items-center gap-1 px-2 py-1 rounded-full
                  text-[11px] font-bold text-white" style={{ background: 'rgba(6,45,33,.72)' }}>
                  <Images size={12} strokeWidth={2.5} aria-hidden="true" />{photos.length}
                </span>
              )}
              <span className="absolute bottom-2.5 left-2.5 text-[11px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: tone.bg, color: tone.fg }}>
                {STATUS_LABEL[p.status] || p.status}
              </span>
            </div>
            <div className="p-4">
              <h3 className="font-bold text-[14px] leading-snug" style={{ color: COLORS.green900 }}>{p.title}</h3>
              <div className="mt-1 text-[12px]" style={{ color: COLORS.muted }}>
                {[p.village, p.union_council, p.year].filter(Boolean).join(' · ')}
              </div>
              {p.approved_cost > 0 && (
                <div className="mt-2 text-[13px] font-bold tabular-nums" style={{ color: COLORS.green900 }}
                  title={exactMoney(p.approved_cost, cur)}>{money(p.approved_cost, cur)}</div>
              )}
              <span className="mt-3 inline-block text-[12px] font-bold underline" style={{ color: COLORS.green700 }}>
                View full details
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

const NoMatch = () => (
  <div className={statCard + ' text-center text-[13px]'} style={{ color: COLORS.muted }}>
    No projects match these filters.
  </div>
);

function ProjectList({ projects, cur, onOpen }) {
  if (!projects.length) return <NoMatch />;
  return (
    <div className={statCard}>
      <ul className="space-y-4">
        {projects.map(p => {
          const tone = STATUS_TONE[p.status] || {};
          const meta = [p.scheme_no && `Scheme ${p.scheme_no}`, p.department, p.category,
            [p.village, p.union_council].filter(Boolean).join(', '), p.year].filter(Boolean);
          const dates = [
            p.approved_date && `Approved ${fmtDate(p.approved_date)}`,
            p.start_date && `Started ${fmtDate(p.start_date)}`,
            p.target_date && `Target ${fmtDate(p.target_date)}`,
            p.completion_date && `Completed ${fmtDate(p.completion_date)}`,
          ].filter(Boolean);

          return (
            <li key={p.id} className="rounded-tnr border p-4" style={{ borderColor: COLORS.neutral }}>
              <div className="flex flex-wrap items-start gap-x-3 gap-y-1.5">
                <h3 className="font-bold text-[14px]" style={{ color: COLORS.green900 }}>{p.title}</h3>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: tone.bg, color: tone.fg }}>
                  {STATUS_LABEL[p.status] || p.status}
                </span>
                {p.approved_cost > 0 && (
                  <span className="ml-auto text-[13px] font-bold tabular-nums" style={{ color: COLORS.green900 }}
                    title={exactMoney(p.approved_cost, cur)}>
                    {money(p.approved_cost, cur)}
                  </span>
                )}
              </div>

              {!!meta.length && (
                <div className="mt-1 text-[12px]" style={{ color: COLORS.muted }}>{meta.join(' · ')}</div>
              )}

              {p.summary && (
                <p className="mt-2 text-[13px] leading-relaxed" style={{ color: COLORS.charcoal }}>{p.summary}</p>
              )}

              {p.progress_percent > 0 && (
                <div className="mt-3">
                  <div className="flex justify-between text-[11px] mb-1" style={{ color: COLORS.muted }}>
                    <span>Physical progress</span><span className="tabular-nums">{p.progress_percent}%</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: COLORS.neutral }}>
                    <div className="h-full rounded-full"
                      style={{ width: `${p.progress_percent}%`, background: COLORS.green700 }} />
                  </div>
                </div>
              )}

              {(p.released_funds > 0 || p.utilised_funds > 0 || p.beneficiaries > 0) && (
                <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1 text-[12px]" style={{ color: COLORS.muted }}>
                  {p.released_funds > 0 && <span>Released: <b style={{ color: COLORS.charcoal }}>{money(p.released_funds, cur)}</b></span>}
                  {p.utilised_funds > 0 && <span>Utilised: <b style={{ color: COLORS.charcoal }}>{money(p.utilised_funds, cur)}</b></span>}
                  {p.beneficiaries > 0 && <span>People served: <b style={{ color: COLORS.charcoal }}>{p.beneficiaries.toLocaleString()}</b></span>}
                </div>
              )}

              {!!dates.length && (
                <div className="mt-2 text-[12px]" style={{ color: COLORS.muted }}>{dates.join(' · ')}</div>
              )}

              {/* Provenance. A public-spending figure without a source is a
                  rumour, so it is shown with the project, not buried. */}
              {(p.source || p.last_verified) && (
                <div className="mt-2.5 pt-2.5 border-t text-[11px]" style={{ borderColor: COLORS.neutral, color: COLORS.muted }}>
                  {p.source && <>Source: {p.source}</>}
                  {p.source && p.last_verified && ' · '}
                  {p.last_verified && <>Last checked {fmtDate(p.last_verified)}</>}
                </div>
              )}

              <div className="mt-3 flex items-center gap-3">
                <button onClick={() => onOpen(p.id)}
                  className="text-[12px] font-bold underline" style={{ color: COLORS.green700 }}>
                  View full details
                </button>
                {allPhotos(p).length > 0 && (
                  <span className="flex items-center gap-1 text-[11px]" style={{ color: COLORS.muted }}>
                    <Images size={12} strokeWidth={2.5} aria-hidden="true" />
                    {allPhotos(p).length} photo{allPhotos(p).length === 1 ? '' : 's'}
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
