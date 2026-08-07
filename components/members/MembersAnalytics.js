'use client';
import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { areaColor } from '@/lib/design/tokens';

// Recharts is the heaviest thing on this page and is not needed for the first
// paint, so it loads on the client only. If it fails, the cards, ranking table
// and summary still render — the section no longer lives or dies by the chart.
const DistributionDonut = dynamic(() => import('./DistributionDonut'), {
  ssr: false,
  loading: () => <div className="h-full w-full grid place-items-center text-xs text-gray-300">Loading chart…</div>,
});

const C = { deep: '#063D2B', green: '#0B6B4F', gold: '#D4A72C', ink: '#15231D' };
const mont = { fontFamily: 'var(--font-mulish), Mulish, system-ui, sans-serif' };

// Colours come from the shared token so a village is the same colour here and
// on the admin dashboard. Gold stays reserved for the combined "Other" slice.
const OTHER = '#D4A72C';

const card = 'rounded-tnr-lg bg-white p-5 shadow-tnr-flat border border-[rgba(200,154,43,.35)]';
const head = 'text-[11px] font-black tracking-[.14em] uppercase';

function Skeleton() {
  return <div className="grid lg:grid-cols-12 gap-4 animate-pulse">
    <div className="lg:col-span-3 space-y-4">
      <div className="h-48 rounded-2xl bg-gray-100" /><div className="h-64 rounded-2xl bg-gray-100" />
    </div>
    <div className="lg:col-span-5 h-[420px] rounded-2xl bg-gray-100" />
    <div className="lg:col-span-4 h-[420px] rounded-2xl bg-gray-100" />
  </div>;
}

function Legend({ segments, colors, active, onHover }) {
  return <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1.5">
    {segments.map((s, i) => (
      <button key={s.name} onMouseEnter={() => onHover(i)} onMouseLeave={() => onHover(null)}
        onClick={() => onHover(active === i ? null : i)}
        className="flex items-center gap-1.5 text-[11px] transition-opacity"
        style={{ opacity: active === null || active === i ? 1 : .4 }}>
        <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: colors[i] }} />
        <span className="text-gray-600">{s.name}</span>
        <span className="font-bold" style={{ color: C.deep }}>{s.members}</span>
      </button>
    ))}
  </div>;
}

export default function MembersAnalytics() {
  const [s, setS] = useState(null);
  const [err, setErr] = useState('');
  const [active, setActive] = useState(null);

  useEffect(() => {
    // Surface the real reason on failure — a silent skeleton is impossible to
    // debug from a screenshot.
    fetch('/api/public/member-stats?t=' + Date.now(), { cache: 'no-store' })
      .then(async r => {
        const body = await r.text();
        let j = null;
        try { j = JSON.parse(body); } catch {
          throw new Error(`Stats endpoint returned ${r.status} (not JSON).`);
        }
        if (!j?.ok) throw new Error(j?.message || j?.error || `Stats endpoint returned ${r.status}.`);
        if (!j.stats || typeof j.stats.total !== 'number') throw new Error('Stats payload was empty.');
        return j.stats;
      })
      .then(st => setS({
        total: 0, totalAreas: 0, ranked: [], top5: [], segments: [],
        otherAreas: [], unassigned: 0, balanced: true, ...st,
      }))
      .catch(e => setErr(e.message || 'Statistics are unavailable right now.'));
  }, []);

  const colors = useMemo(
    // Same generator the admin dashboard uses, so a village is the same colour
    // on both sides of the platform. Gold stays reserved for "Other Areas".
    () => (s?.segments || []).map((seg, i) => (seg.isOther ? OTHER : areaColor(i))),
    [s]);

  if (err) return <div className={card + ' text-center py-10'}>
    <h3 style={{ ...mont, color: C.deep }} className="font-extrabold">Membership statistics unavailable</h3>
    <p className="mt-1 text-xs text-gray-400">{err}</p>
  </div>;
  if (!s) return <Skeleton />;

  if (s.total === 0) return <div className={card + ' text-center py-14'}>
    <div className="text-4xl">📊</div>
    <h3 style={{ ...mont, color: C.deep }} className="mt-3 font-extrabold">No active members yet</h3>
    <p className="mt-1 text-sm text-gray-500">Analytics appear once memberships are approved.</p>
  </div>;

  // The slices must reconcile with the headline total, or we say so plainly
  // rather than publishing figures that do not add up.
  if (!s.balanced) return <div className={card + ' text-center py-10'}>
    <h3 style={{ ...mont, color: C.deep }} className="font-extrabold">Statistics are being verified</h3>
    <p className="mt-1 text-sm text-gray-500">
      Membership figures are temporarily unavailable while the records are reconciled.
    </p>
  </div>;

  return <div className="space-y-4" style={mont}>
    <div className="grid lg:grid-cols-12 gap-4">

      {/* ── LEFT ── */}
      <div className="lg:col-span-3 space-y-4 order-1 lg:order-none">
        <div className={card}>
          <div className={head} style={{ color: C.green }}>Total Members</div>
          <div className="mt-3 flex items-center gap-3">
            <svg width="40" height="40" viewBox="0 0 24 24" fill={C.green} className="shrink-0">
              <path d="M16 11a4 4 0 100-8 4 4 0 000 8zm-8 0a3 3 0 100-6 3 3 0 000 6zm0 2c-2.7 0-8 1.34-8 4v3h9v-3c0-1.1.44-2.07 1.16-2.84A13.6 13.6 0 008 13zm8 0c-3 0-9 1.5-9 4.5V21h18v-3.5c0-3-6-4.5-9-4.5z" />
            </svg>
            <div className="text-5xl font-black leading-none" style={{ color: C.deep }}>{s.total}</div>
          </div>
          <div className="mt-1 text-[11px] font-bold tracking-widest uppercase text-gray-400">Members</div>
          <div className="mt-4 pt-4 border-t border-gray-100 text-sm italic text-gray-600 leading-snug">
            “Stronger Together, Building a Better Roundu”
          </div>
        </div>

        <div className={card + ' order-4 lg:order-none'}>
          <div className={head} style={{ color: C.green }}>Top 5 Areas</div>
          <ol className="mt-3 space-y-1">
            {s.top5.map(r => (
              <li key={r.area} className="flex items-center gap-2.5 py-1.5 border-b border-gray-50 last:border-0">
                <span className="w-5 h-5 rounded-full grid place-items-center text-[10px] font-black text-white shrink-0"
                  style={{ background: areaColor(r.rank - 1) }}>{r.rank}</span>
                <span className="flex-1 text-sm text-gray-700 truncate">{r.area}</span>
                <span className="text-sm font-black" style={{ color: C.deep }}>{r.members}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className={card} style={{ background: '#F6FAF8' }}>
          <div className="flex items-center gap-3">
            <svg width="30" height="30" viewBox="0 0 24 24" fill={C.green} className="shrink-0">
              <path d="M12 2a7 7 0 00-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 00-7-7zm0 9.5A2.5 2.5 0 1112 6.5a2.5 2.5 0 010 5z" />
            </svg>
            <div>
              <div className="text-3xl font-black leading-none" style={{ color: C.deep }}>{s.totalAreas}</div>
              <div className="text-[11px] text-gray-500 mt-0.5">Villages / Areas of Roundu</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── CENTRE ── */}
      <div className={card + ' lg:col-span-5 order-3 lg:order-none'}>
        <div className={head + ' text-center'} style={{ color: C.green }}>
          Membership Distribution by Village / Area
        </div>
        <div className="relative mt-2" style={{ height: 320 }}>
          <DistributionDonut segments={s.segments} colors={colors}
            active={active} setActive={setActive} />

          <div className="absolute inset-0 grid place-items-center pointer-events-none">
            <div className="text-center">
              <div className="text-4xl font-black leading-none" style={{ color: C.deep }}>
                {active === null ? s.total : s.segments[active].members}
              </div>
              <div className="text-[10px] font-black tracking-[.16em] uppercase mt-1"
                style={{ color: active === null ? '#9CA3AF' : C.gold }}>
                {active === null ? 'Total Members' : s.segments[active].name}
              </div>
            </div>
          </div>
        </div>
        <Legend segments={s.segments} colors={colors} active={active} onHover={setActive} />
        <p className="mt-3 text-center text-[10px] text-gray-400">Tap or hover a segment for details</p>

        {/* Text equivalent of the donut. Charts are unreadable to screen
            readers, so the same figures are exposed as a real table. */}
        <table className="tnr-sr-only">
          <caption>Membership distribution by village or area</caption>
          <thead><tr><th scope="col">Village / Area</th><th scope="col">Members</th><th scope="col">Share</th></tr></thead>
          <tbody>
            {s.segments.map(seg => (
              <tr key={seg.name}>
                <th scope="row">{seg.name}</th><td>{seg.members}</td><td>{seg.percent}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── RIGHT ── */}
      <div className={card + ' lg:col-span-4 order-4 lg:order-none'}>
        <div className={head} style={{ color: C.green }}>Members by Village / Area</div>
        <div className="mt-3 max-h-[360px] overflow-y-auto -mx-1 px-1">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="text-[10px] uppercase tracking-wider text-gray-400 text-left">
                <th className="py-2 w-8 font-bold">#</th>
                <th className="py-2 font-bold">Village / Area</th>
                <th className="py-2 text-right font-bold">Members</th>
              </tr>
            </thead>
            <tbody>
              {s.ranked.map(r => (
                <tr key={r.area} className="border-t border-gray-50">
                  <td className="py-2">
                    <span className="w-5 h-5 rounded-full grid place-items-center text-[10px] font-black text-white"
                      style={{ background: areaColor(r.rank - 1) }}>
                      {r.rank}
                    </span>
                  </td>
                  <td className="py-2 text-gray-700">{r.area}</td>
                  <td className="py-2 text-right font-black" style={{ color: C.deep }}>{r.members}</td>
                </tr>
              ))}
              {s.unassigned > 0 && (
                <tr className="border-t border-gray-100" style={{ background: '#FBFBFA' }}>
                  <td /><td className="py-2 text-gray-400 italic">Area not recorded</td>
                  <td className="py-2 text-right font-black text-gray-400">{s.unassigned}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    {/* ── OTHER AREAS ── */}
    {s.otherAreas.length > 0 && (
      <div className={card + ' order-6'}>
        <div className={head} style={{ color: C.green }}>Other Areas ({s.otherAreas.length})</div>
        <div className="mt-3 flex flex-wrap gap-2">
          {s.otherAreas.map(r => (
            <span key={r.area} className="rounded-full px-3 py-1 text-xs text-gray-600"
              style={{ background: '#F6FAF8' }}>
              {r.area} <b style={{ color: C.deep }}>({r.members})</b>
            </span>
          ))}
        </div>
      </div>
    )}

    {/* ── SUMMARY ── */}
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[
        [s.totalAreas, 'Villages / Areas Represented', C.green],
        [s.total, 'Total Active Members', '#137F5D'],
        [s.community?.unionCouncils ?? '—', 'Union Councils', C.deep],
        [s.community?.professionals ?? '—', 'Professionals', C.gold],
      ].map(([v, l, col]) => (
        <div key={l} className={card + ' text-center'}>
          <div className="text-3xl font-black leading-none" style={{ color: col }}>{v}</div>
          <div className="mt-1.5 text-[11px] text-gray-500 leading-tight">{l}</div>
        </div>
      ))}
    </div>

    {/* ── STATEMENT ── */}
    <div className="rounded-2xl px-6 py-8 text-center"
      style={{ background: `linear-gradient(135deg,${C.deep},#04241A)` }}>
      <div className="text-xl sm:text-2xl font-black text-white leading-snug">
        Our Villages, Our Strength, Our Future
      </div>
      <div className="mx-auto mt-3 w-16 h-[2px]" style={{ background: C.gold }} />
    </div>
  </div>;
}
