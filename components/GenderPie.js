'use client';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const C = { deep: '#063D2B', green: '#0B6B4F', gold: '#D4A72C', ink: '#15231D' };
const mont = { fontFamily: 'var(--font-mulish), Mulish, system-ui, sans-serif' };

// Voter gender distribution — shown on the homepage after the results graphs.
export default function GenderPie({ stats }) {
  const g = stats?.gender;
  const male = g?.male || 0, female = g?.female || 0;
  if (!male && !female) return null;

  const total = male + female + (g?.other || 0);
  const data = [
    { name: 'Male Voters', value: male, color: C.green },
    { name: 'Female Voters', value: female, color: C.gold },
    ...(g?.other ? [{ name: 'Other', value: g.other, color: '#9CA3AF' }] : []),
  ];
  const pct = (v) => total ? Math.round((v / total) * 1000) / 10 : 0;

  return (
    <section className="max-w-6xl mx-auto px-4 pb-14">
      <div className="text-center">
        <h2 style={{ ...mont, color: C.deep }} className="text-3xl font-black mt-1">Registered Voters by Gender</h2>
        <div className="w-14 h-1 mx-auto mt-3 rounded-full" style={{ background: `linear-gradient(90deg,${C.green},${C.gold})` }} />
      </div>

      <div className="mt-8 grid md:grid-cols-[1fr,1fr] gap-6 items-center rounded-3xl border border-gray-100 bg-white shadow-xl p-6">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="85%"
                paddingAngle={3} strokeWidth={0}>
                {data.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
              <Tooltip formatter={(v, n) => [`${v} voter(s) · ${pct(v)}%`, n]} />
              <Legend verticalAlign="bottom" height={28} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="space-y-3">
          {data.map(d => (
            <div key={d.name} className="flex items-center gap-3 rounded-2xl border border-gray-100 px-4 py-3">
              <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ background: d.color }} />
              <span className="font-semibold text-sm" style={{ color: C.ink }}>{d.name}</span>
              <span className="ml-auto text-sm text-gray-500">{d.value} · <b style={{ color: C.deep }}>{pct(d.value)}%</b></span>
            </div>
          ))}
          <div className="flex items-center gap-3 rounded-2xl px-4 py-3 text-white" style={{ background: `linear-gradient(165deg,${C.deep},#0B120F)` }}>
            <span className="font-semibold text-sm">Total Registered Voters</span>
            <span className="ml-auto font-black" style={{ ...mont, color: '#F3E4B3' }}>{total}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
