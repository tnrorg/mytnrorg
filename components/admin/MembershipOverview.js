'use client';
import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import { aGet } from './adminApi';
import { Card } from './ui';
import { areaColor } from '@/lib/design/tokens';

// Recharts is heavy and not needed for first paint, and isolating it means a
// chart problem cannot take the cards and tables down with it.
const OverviewCharts = dynamic(() => import('./OverviewCharts'), {
  ssr: false,
  loading: () => <div className="h-72 grid place-items-center text-xs text-tnr-cream/40">Loading charts…</div>,
});

const ROLE_COLORS = {
  advisory: '#C89A2B', cec: '#0E7A5A', uc_team: '#4FB088', general: '#A2D7C2',
};

export default function MembershipOverview() {
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  // A Set, not a single value: expanding one council must not collapse
  // another. Comparing cards side by side is the whole point of this view.
  const [open, setOpen] = useState(() => new Set());
  const toggle = (name) => setOpen(prev => {
    const next = new Set(prev);
    next.has(name) ? next.delete(name) : next.add(name);
    return next;
  });

  useEffect(() => {
    aGet('/api/admin/membership/overview')
      .then(r => (r?.ok ? setD(r) : setErr(r?.message || 'Could not load the membership overview.')))
      .catch(e => setErr(e.message || 'Request failed.'));
  }, []);

  const councilChart = useMemo(
    () => (d?.councils || []).filter(c => c.members > 0)
      .map((c, i) => ({ name: c.name, value: c.members, fill: areaColor(i) })), [d]);

  const villageChart = useMemo(() => {
    const all = (d?.councils || []).flatMap(c => c.villages.map(v => ({ ...v, council: c.name })));
    return all.filter(v => v.members > 0)
      .sort((a, b) => b.members - a.members)
      .map((v, i) => ({ name: v.name, value: v.members, council: v.council, fill: areaColor(i) }));
  }, [d]);

  if (err) return <Card><div className="text-sm text-red-300">{err}</div></Card>;
  if (!d) return <Card><div className="text-sm text-tnr-cream/60">Loading membership overview…</div></Card>;

  return <div className="space-y-4">

    {/* ── Membership by type ── */}
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {d.roles.map(r => (
        <Card key={r.key}>
          <div className="text-3xl font-black" style={{ color: ROLE_COLORS[r.key] || '#F1EDE2' }}>
            {r.members}
          </div>
          <div className="text-[11px] uppercase tracking-wider text-tnr-cream/50 mt-1">{r.label}</div>
        </Card>
      ))}
    </div>

    {/* ── Union Councils and their villages ── */}
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
        <h3 className="font-black text-tnr-cream">Union Councils & Villages</h3>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-tnr-cream/50">
            {d.listedCouncils} councils · {d.listedVillages} villages listed · {d.total} active members
          </span>
          <button
            onClick={() => setOpen(prev =>
              prev.size ? new Set() : new Set(d.councils.map(c => c.name)))}
            className="text-[11px] font-semibold text-tnr-goldLight hover:underline whitespace-nowrap">
            {open.size ? 'Collapse all' : 'Expand all'}
          </button>
        </div>
      </div>
      <p className="text-xs text-tnr-cream/45 mb-4">
        Councils with no members yet still appear, so you can see where recruitment has not reached.
      </p>

      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {d.councils.map((c, i) => {
          const expanded = open.has(c.name);
          return (
            <div key={c.name}
              className="rounded-xl p-4 border transition-colors duration-standard
                hover:border-[rgba(200,154,43,.7)]"
              style={{ background: 'rgba(3,26,18,.35)', borderColor: 'rgba(200,154,43,.35)' }}>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: areaColor(i) }} />
                <h4 className="font-bold text-sm text-tnr-cream truncate">{c.name}</h4>
                <span className="ml-auto text-lg font-black" style={{ color: '#EBC55C' }}>{c.members}</span>
              </div>
              <div className="mt-1 text-[11px] text-tnr-cream/45">
                {c.villages.length} village{c.villages.length === 1 ? '' : 's'}
                {c.unlisted && <span className="text-amber-300"> · not on the managed list</span>}
              </div>

              <ul className="mt-3 space-y-1">
                {(expanded ? c.villages : c.villages.slice(0, 4)).map(v => (
                  <li key={v.name} className="flex items-center gap-2 text-[12px]">
                    <span className="flex-1 truncate text-tnr-cream/75">
                      {v.name}
                      {v.unlisted && <span className="text-amber-300/70"> *</span>}
                    </span>
                    <span className="font-bold text-tnr-cream/90 tabular-nums">{v.members}</span>
                  </li>
                ))}
                {!c.villages.length && <li className="text-[12px] text-tnr-cream/30">No villages added yet</li>}
              </ul>

              {c.villages.length > 4 && (
                <button onClick={() => toggle(c.name)}
                  className="mt-2 text-[11px] font-semibold text-tnr-goldLight hover:underline">
                  {expanded ? 'Show less' : `Show all ${c.villages.length}`}
                </button>
              )}
            </div>
          );
        })}
      </div>
      {d.councils.some(c => c.villages.some(v => v.unlisted)) && (
        <p className="mt-3 text-[11px] text-amber-300/80">
          * Typed by a member but not on the managed area list — add it under Areas so it appears in the dropdowns.
        </p>
      )}
    </Card>

    <OverviewCharts councilChart={councilChart} villageChart={villageChart}
      roles={d.roles} roleColors={ROLE_COLORS} />
  </div>;
}
