'use client';
import { useMemo, useState } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
  PieChart, Pie, LabelList,
} from 'recharts';
import VictorySign from './VictorySign';

const CH = { green: '#07543d', gold: '#d8a821', muted: '#9ca3af', grid: '#e5e7eb', text: '#1a1a1a' };

export default function ResultsAnalytics({ data }) {
  const e = data?.election;
  const stats = data?.stats;
  const vis = data?.visibility;
  const positions = (data?.positions || []).filter(p => p.id !== 0 && (p.candidates || []).length > 0);
  const [active, setActive] = useState(0);
  if (!e || !positions.length) return null;

  const ended = e.ended;
  const label = ended ? 'FINAL ELECTION RESULTS' : 'LIVE ELECTION ANALYTICS';

  // ── Hidden state ────────────────────────────────────────────────────────
  if (vis === 'hidden') {
    return (
      <section id="analytics" className="max-w-6xl mx-auto px-4 py-14">
        <Header label={label} />
        <div className="rounded-3xl bg-white border border-gray-200 shadow-[0_20px_50px_-24px_rgba(0,0,0,0.18)] p-10 text-center max-w-2xl mx-auto">
          <div className="text-5xl mb-3">🔒</div>
          <h3 className="text-xl font-extrabold text-[#063D2B]">RESULTS ARE CURRENTLY HIDDEN</h3>
          <p className="text-gray-500 mt-2 font-medium">Live election results will be available according to the official election schedule.</p>
          {e.ends_at && <p className="text-sm text-gray-400 mt-3 tabular-nums">Voting closes: {new Date(e.ends_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</p>}
          <p className="text-xs text-[#0B6B4F] mt-4 font-semibold">Secure &amp; transparent voting · One member, one vote</p>
        </div>
      </section>
    );
  }

  const pos = positions[Math.min(active, positions.length - 1)];
  const cands = pos.candidates || [];
  const hasCounts = cands.some(c => c.votes != null);
  const hasPercent = cands.some(c => c.percent != null);
  const totalVotes = hasCounts ? cands.reduce((s, c) => s + (c.votes || 0), 0) : null;

  // value used to size bars / slices (votes preferred, else percent)
  const val = c => (c.votes != null ? c.votes : (c.percent != null ? c.percent : 0));
  const maxVal = Math.max(0, ...cands.map(val));
  const chartData = cands.map((c, i) => ({
    name: c.name, short: shortName(c.name), number: c.number, symbol: c.symbol,
    photo: c.photo_url, votes: c.votes, percent: c.percent, value: val(c),
    color: maxVal === 0 ? CH.muted : (val(c) === maxVal ? CH.green : CH.gold),
  }));

  const anyVotes = maxVal > 0;
  const leadingC = anyVotes ? cands.reduce((a, b) => (val(b) > val(a) ? b : a)) : null;
  const tie = cands.length > 1 && cands.every(c => val(c) === val(cands[0])) && anyVotes;

  return (
    <section id="analytics" className="max-w-6xl mx-auto px-4 py-14 animate-fade-up">
      <Header label={label} />

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-8">
        <Stat icon="👥" label="Registered Voters" value={stats?.total_voters ?? '—'} />
        <Stat icon="🗳️" label="Votes Submitted" value={stats?.votes_cast ?? '—'} gold />
        <Stat icon="⏳" label="Remaining Voters" value={stats?.remaining ?? '—'} />
        <Stat icon="📈" label="Voter Turnout" value={stats != null ? `${stats.turnout}%` : '—'} gold />
      </div>

      {/* Position tabs */}
      <div className="flex flex-wrap gap-2 mt-8 justify-center">
        {positions.map((p, i) => (
          <button key={p.id} onClick={() => setActive(i)}
            className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${i === active
              ? 'text-white shadow-md' : 'text-[#063D2B] bg-white border border-gray-200 hover:border-[#0B6B4F]/40'}`}
            style={i === active ? { background: 'linear-gradient(120deg,#063D2B,#0B6B4F)', boxShadow: '0 0 0 2px #D4A72C' } : {}}>
            {p.title}
          </button>
        ))}
      </div>

      {/* Status line */}
      <div className="text-center mt-6">
        <StatusLine pos={pos} ended={ended} leadingC={leadingC} tie={tie} anyVotes={anyVotes} cands={cands} val={val} totalVotes={totalVotes} hasCounts={hasCounts} />
      </div>

      {!anyVotes ? (
        <div className="rounded-3xl bg-white border border-gray-200 shadow-sm p-10 text-center mt-6">
          <h3 className="text-lg font-extrabold text-[#063D2B]">NO VOTES SUBMITTED YET</h3>
          <p className="text-gray-500 mt-1 font-medium tabular-nums">0 total votes · 0% turnout for this position</p>
        </div>
      ) : (
        <div className="grid lg:grid-cols-[3fr_2fr] gap-4 mt-6">
          {/* Bar chart */}
          <ChartCard title="CANDIDATE VOTE COMPARISON">
            <div className="h-64 sm:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 8, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CH.grid} vertical={false} />
                  <XAxis dataKey="short" tick={{ fill: CH.text, fontSize: 12, fontWeight: 600 }} tickLine={false} axisLine={{ stroke: CH.grid }} />
                  <YAxis allowDecimals={false} tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip content={<ChartTip hasCounts={hasCounts} />} cursor={{ fill: 'rgba(7,84,61,0.06)' }} />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]} isAnimationActive animationDuration={700}>
                    {chartData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    <LabelList dataKey={hasCounts ? 'votes' : 'percent'} position="top"
                      formatter={(v) => (v == null ? '' : (hasCounts ? v : `${v}%`))}
                      style={{ fill: CH.text, fontWeight: 800, fontSize: 12 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          {/* Donut chart */}
          <ChartCard title="VOTE SHARE">
            <div className="relative h-64 sm:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip content={<ChartTip hasCounts={hasCounts} />} />
                  <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                    innerRadius="58%" outerRadius="82%" paddingAngle={2} stroke="#fff" strokeWidth={2}
                    isAnimationActive animationDuration={700}>
                    {chartData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <div className="text-[10px] font-bold tracking-widest text-gray-400">{ended ? 'FINAL RESULTS' : 'LIVE RESULTS'}</div>
                <div className="text-3xl font-black text-[#063D2B] tabular-nums">{hasCounts ? totalVotes : '—'}</div>
                <div className="text-[10px] font-semibold text-gray-400">{hasCounts ? 'TOTAL VOTES' : 'SHARE'}</div>
              </div>
            </div>
            {/* Legend */}
            <div className="mt-3 space-y-1.5">
              {chartData.map((d, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className="w-3 h-3 rounded-sm" style={{ background: d.color }} />
                  <span className="text-[#15231D] font-semibold flex-1 truncate">{d.name}</span>
                  <span className="text-gray-500 tabular-nums">{d.votes != null ? `${d.votes} · ` : ''}{d.percent != null ? `${d.percent}%` : ''}</span>
                </div>
              ))}
            </div>
          </ChartCard>
        </div>
      )}

      {/* Accessible fallback + last updated */}
      <ul className="sr-only">
        {chartData.map((d, i) => <li key={i}>{d.name} — {d.votes != null ? `${d.votes} votes` : ''} — {d.percent != null ? `${d.percent}%` : ''}</li>)}
      </ul>
      <p className="text-center text-xs text-gray-400 mt-4 tabular-nums">Last updated: {new Date().toLocaleTimeString()}</p>
    </section>
  );
}

/* ── pieces ─────────────────────────────────────────────────────────────── */
function Header({ label }) {
  return <div className="text-center">
    <div className="text-xs font-bold tracking-[0.2em] text-[#D4A72C]">{label}</div>
    <h2 className="text-3xl sm:text-4xl font-black text-[#063D2B] mt-1">ELECTION RESULTS AT A GLANCE</h2>
    <div className="w-20 h-1 rounded-full mx-auto mt-3" style={{ background: 'linear-gradient(90deg,#0B6B4F,#D4A72C)' }} />
    <p className="text-gray-500 mt-3 max-w-2xl mx-auto font-medium">Compare candidate performance and view the current vote distribution for every election position.</p>
  </div>;
}
function Stat({ icon, label, value, gold }) {
  return <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-4 sm:p-5 text-center">
    <div className="text-lg">{icon}</div>
    <div className={`text-2xl sm:text-3xl font-black tabular-nums ${gold ? 'text-[#D4A72C]' : 'text-[#063D2B]'}`}>{value}</div>
    <div className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold">{label}</div>
  </div>;
}
function ChartCard({ title, children }) {
  return <div className="rounded-3xl bg-white border border-gray-200 shadow-[0_20px_50px_-28px_rgba(0,0,0,0.2)] p-5 sm:p-6">
    <h3 className="text-sm font-extrabold tracking-wide text-[#063D2B] mb-3">{title}</h3>
    {children}
  </div>;
}
function StatusLine({ pos, ended, leadingC, tie, anyVotes, cands, val, totalVotes, hasCounts }) {
  if (!anyVotes) return <span className="inline-block px-4 py-2 rounded-full bg-gray-100 text-gray-500 font-semibold text-sm">No result yet for {pos.title}</span>;
  if (tie) return <span className="inline-block px-4 py-2 rounded-full bg-gray-100 text-[#063D2B] font-bold text-sm">RESULT CURRENTLY TIED</span>;
  const other = cands.find(c => c.id !== leadingC.id);
  const margin = other ? Math.abs((val(leadingC)) - (val(other))) : 0;
  const pct = leadingC.percent != null ? ` with ${leadingC.percent}% of the valid vote` : '';
  if (ended) {
    return <div className="inline-flex flex-col items-center gap-1">
      <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full font-black text-[#063D2B] shadow"
        style={{ background: 'linear-gradient(180deg,#F3E4B3,#D4A72C)' }}>
        <span className="text-[#063D2B]" style={{ filter: 'drop-shadow(0 0 4px rgba(212,167,44,0.6))' }}><VictorySign size={18} /></span>
        {up(leadingC.name)} ELECTED AS {up(pos.title)}
      </span>
      {hasCounts && <span className="text-sm text-gray-500 font-medium tabular-nums">Won by {margin} vote{margin === 1 ? '' : 's'}{pct}.</span>}
    </div>;
  }
  return <span className="inline-block px-4 py-2 rounded-full bg-[#0B6B4F]/10 text-[#0B6B4F] font-bold text-sm">
    {up(leadingC.name)} IS LEADING{hasCounts ? ` BY ${margin} VOTE${margin === 1 ? '' : 'S'}` : ''}
  </span>;
}
function ChartTip({ active, payload, hasCounts }) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;
  return <div className="rounded-xl bg-white shadow-lg border border-gray-200 p-3 text-left min-w-[160px]">
    <div className="flex items-center gap-2">
      <img src={d.photo || '/tnr-logo.png'} alt="" className="w-8 h-8 rounded-lg object-cover border border-gray-200" />
      <div><div className="font-extrabold text-[#063D2B] text-sm leading-tight">{d.name}</div>
        <div className="text-[11px] text-gray-400">Candidate #{d.number}{d.symbol ? ` · ${d.symbol}` : ''}</div></div>
    </div>
    <div className="mt-2 text-sm font-bold text-[#15231D] tabular-nums">
      {d.percent != null ? `${d.percent}% of valid vote` : ''}
    </div>
  </div>;
}
const up = s => String(s || '').toUpperCase();
const shortName = s => { const w = String(s || '').split(' '); return w.length > 2 ? `${w[0]} ${w[w.length - 1]}` : s; };
