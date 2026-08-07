'use client';
import { useEffect, useState } from 'react';
import { aGet } from './adminApi';
import { exportResultsPdf } from './exporters';
import { Card, Badge } from './ui';
export default function ResultsTab({ elections }) {
  const [r, setR] = useState(null);
  useEffect(() => { aGet('/api/admin/results').then(setR); }, []);
  if (!r?.ok) return <p className="text-tnr-cream/50">Loading…</p>;
  if (r.preview_disabled) return <div className="card p-8 text-center text-tnr-cream/60">Admin live preview is disabled in fairness settings.</div>;
  const title = elections?.[0]?.title || 'Election';
  return <div className="space-y-4">
    <div className="flex items-center justify-between">
      <div className="chip bg-tnr-gold/15 text-tnr-goldLight border border-tnr-line">👁 Admin preview — total {r.total_votes} votes</div>
      <button className="btn-ghost !py-2 text-sm" onClick={() => exportResultsPdf({ election: { title }, positions: r.positions })}>Export PDF</button>
    </div>
    {r.positions.map(p => <Card key={p.position_id}>
      <div className="flex items-center justify-between mb-3"><h3 className="font-bold text-tnr-goldLight">{p.position}</h3><span className="text-xs text-tnr-cream/50">{p.total} votes</span></div>
      {p.candidates.map(c => <div key={c.id} className="mb-2">
        <div className="flex items-center gap-2 mb-1"><span className="flex-1 text-tnr-cream">{c.name}</span>
          {p.winner === c.id && <Badge tone="gold">🏆 Leading</Badge>}<span className="text-tnr-goldLight font-bold">{c.votes} · {c.percent}%</span></div>
        <div className="h-2 rounded-full bg-black/40 overflow-hidden"><div className="h-full bg-gradient-to-r from-tnr-green2 to-tnr-gold" style={{ width: c.percent + '%' }} /></div>
      </div>)}
      {!p.candidates.length && <p className="text-tnr-cream/40 text-sm">No candidates.</p>}
    </Card>)}
    {r.union_share?.length > 0 && <Card><h3 className="font-bold text-tnr-goldLight mb-3">Union-wise Vote Share</h3>
      {r.union_share.map(u => { const max = r.union_share[0].votes || 1; return <div key={u.union} className="mb-2">
        <div className="flex justify-between text-sm mb-1"><span className="text-tnr-cream/80">{u.union}</span><span className="text-tnr-goldLight">{u.votes}</span></div>
        <div className="h-2 rounded-full bg-black/40 overflow-hidden"><div className="h-full bg-tnr-gold/80" style={{ width: (u.votes / max) * 100 + '%' }} /></div></div>; })}
    </Card>}
  </div>;
}
