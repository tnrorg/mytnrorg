'use client';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { COLORS } from '@/lib/design/tokens';

/** The donut only. Split into its own module so it can be loaded dynamically
 *  with ssr:false — recharts is heavy, and isolating it means a chart problem
 *  can never take the surrounding cards and table down with it. */
export default function DistributionDonut({ segments, colors, active, setActive }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={segments} dataKey="members" nameKey="name" cx="50%" cy="50%"
          innerRadius="58%" outerRadius="92%" paddingAngle={1.5} stroke="#fff" strokeWidth={2}
          onMouseEnter={(_, i) => setActive(i)} onMouseLeave={() => setActive(null)}
          onClick={(_, i) => setActive(a => (a === i ? null : i))} isAnimationActive={false}>
          {segments.map((seg, i) => (
            <Cell key={seg.name} fill={colors[i]}
              opacity={active === null || active === i ? 1 : 0.35}
              style={{ cursor: 'pointer', outline: 'none' }} />
          ))}
        </Pie>
        <Tooltip content={({ active: on, payload }) => {
          if (!on || !payload?.length) return null;
          const d = payload[0].payload;
          return (
            <div className="rounded-tnr bg-white border border-gray-100 px-3 py-2 text-xs shadow-tnr-raise">
              <div className="font-black" style={{ color: COLORS.green900 }}>{d.name}</div>
              <div className="mt-0.5" style={{ color: COLORS.muted }}>
                {d.members} member{d.members === 1 ? '' : 's'} · {d.percent}%
              </div>
            </div>
          );
        }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
