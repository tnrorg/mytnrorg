'use client';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { Card } from './ui';

const tip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg px-3 py-2 text-xs"
      style={{ background: '#04241A', border: '1px solid rgba(200,154,43,.4)', color: '#F1EDE2' }}>
      <div className="font-black">{d.name}</div>
      {d.council && <div className="opacity-60">{d.council}</div>}
      <div className="mt-0.5">{d.value} member{d.value === 1 ? '' : 's'}</div>
    </div>
  );
};

export default function OverviewCharts({ councilChart, villageChart, roles, roleColors }) {
  const roleData = roles
    .filter(r => r.members > 0)
    .map(r => ({ name: r.label, value: r.members, fill: roleColors[r.key] || '#A2D7C2' }));

  // Long village lists need height, not a squeezed axis — a horizontal bar
  // chart keeps every name readable however many villages there are.
  const barHeight = Math.max(220, villageChart.length * 26);

  return <>
    <div className="grid lg:grid-cols-2 gap-4">
      <Card>
        <h3 className="font-black text-tnr-cream mb-1">Members by Union Council</h3>
        <p className="text-xs text-tnr-cream/45 mb-2">Each council has its own colour.</p>
        {councilChart.length === 0
          ? <div className="h-64 grid place-items-center text-xs text-tnr-cream/40">No members yet</div>
          : <div style={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={councilChart} dataKey="value" nameKey="name" cx="50%" cy="50%"
                    innerRadius="52%" outerRadius="86%" paddingAngle={1.5}
                    stroke="#FFFFFF" strokeWidth={2} isAnimationActive={false}>
                    {councilChart.map(d => <Cell key={d.name} fill={d.fill} />)}
                  </Pie>
                  <Tooltip content={tip} />
                </PieChart>
              </ResponsiveContainer>
            </div>}
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
          {councilChart.map(d => (
            <span key={d.name} className="inline-flex items-center gap-1.5 text-[11px] text-tnr-cream/70">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: d.fill }} />
              {d.name} <b className="text-tnr-cream">{d.value}</b>
            </span>
          ))}
        </div>
      </Card>

      <Card>
        <h3 className="font-black text-tnr-cream mb-1">Members by Type</h3>
        <p className="text-xs text-tnr-cream/45 mb-2">Advisory Council, CEC, UC Team and General.</p>
        {roleData.length === 0
          ? <div className="h-64 grid place-items-center text-xs text-tnr-cream/40">No members yet</div>
          : <div style={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={roleData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                    innerRadius="52%" outerRadius="86%" paddingAngle={1.5}
                    stroke="#FFFFFF" strokeWidth={2} isAnimationActive={false}>
                    {roleData.map(d => <Cell key={d.name} fill={d.fill} />)}
                  </Pie>
                  <Tooltip content={tip} />
                </PieChart>
              </ResponsiveContainer>
            </div>}
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
          {roleData.map(d => (
            <span key={d.name} className="inline-flex items-center gap-1.5 text-[11px] text-tnr-cream/70">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: d.fill }} />
              {d.name} <b className="text-tnr-cream">{d.value}</b>
            </span>
          ))}
        </div>
      </Card>
    </div>

    <Card>
      <h3 className="font-black text-tnr-cream mb-1">Members by Village / Area</h3>
      <p className="text-xs text-tnr-cream/45 mb-3">Every village in its own colour, highest first.</p>
      {villageChart.length === 0
        ? <div className="h-40 grid place-items-center text-xs text-tnr-cream/40">No members yet</div>
        : <div style={{ height: barHeight, maxHeight: 620, overflowY: 'auto' }}>
            <ResponsiveContainer width="100%" height={barHeight}>
              <BarChart data={villageChart} layout="vertical"
                margin={{ top: 4, right: 24, bottom: 4, left: 8 }}>
                <CartesianGrid horizontal={false} stroke="rgba(255,255,255,.07)" />
                <XAxis type="number" allowDecimals={false}
                  tick={{ fill: 'rgba(241,237,226,.5)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={130}
                  tick={{ fill: 'rgba(241,237,226,.75)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={tip} cursor={{ fill: 'rgba(255,255,255,.05)' }} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} isAnimationActive={false}>
                  {villageChart.map(d => <Cell key={d.name} fill={d.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>}
    </Card>
  </>;
}
