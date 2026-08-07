'use client';
import { useEffect, useState } from 'react';
import { aGet } from './adminApi';
import { exportExcel } from './exporters';
import { Card, Stat, Badge } from './ui';
export default function RecordsTab() {
  const [d, setD] = useState(null); const [tab, setTab] = useState('voted');
  useEffect(() => { aGet('/api/admin/records').then(setD); }, []);
  if (!d?.ok) return <p className="text-tnr-cream/50">Loading…</p>;
  const list = tab === 'voted' ? d.voted : d.not_voted;
  return <div className="space-y-4">
    <div className="grid grid-cols-3 gap-3">
      <Stat label="On Voter List" value={d.total} />
      <Stat label="Voted" value={d.voted_count} tone="gold" />
      <Stat label="Not Voted" value={d.total - d.voted_count} />
    </div>
    <div className="card p-3 text-xs text-tnr-cream/60">🔒 Vote privacy: this shows <b>who</b> voted, never <b>which candidate</b> they chose.</div>
    <div className="flex gap-2">
      <button className={`btn-${tab === 'voted' ? 'gold' : 'ghost'} !py-2 text-sm`} onClick={() => setTab('voted')}>Voted ({d.voted_count})</button>
      <button className={`btn-${tab === 'not' ? 'gold' : 'ghost'} !py-2 text-sm`} onClick={() => setTab('not')}>Not Voted ({d.total - d.voted_count})</button>
      <div className="flex-1" />
      <button className="btn-ghost !py-2 text-sm" onClick={() => exportExcel(list.map(m => ({ Name: m.full_name, Mobile: m.mobile, VotedAt: m.voted_at || '' })), 'Records', 'tnr-voting-records.xlsx')}>Export</button>
    </div>
    <Card className="!p-0 overflow-hidden"><div className="overflow-auto max-h-[60vh]">
      <table className="w-full text-sm"><thead className="bg-black/30 sticky top-0"><tr className="text-tnr-cream/60 text-left">
        <th className="px-3 py-2">Name</th><th className="px-3 py-2">Mobile</th><th className="px-3 py-2">{tab === 'voted' ? 'Voted At' : 'Status'}</th></tr></thead>
        <tbody>{list.map(m => <tr key={m.member_id} className="border-t border-tnr-line/40">
          <td className="px-3 py-2 text-tnr-cream">{m.full_name}</td><td className="px-3 py-2 text-tnr-cream/70">{m.mobile}</td>
          <td className="px-3 py-2">{tab === 'voted' ? <span className="text-tnr-cream/60">{new Date(m.voted_at).toLocaleString()}</span> : <Badge>Not Voted</Badge>}</td></tr>)}
          {!list.length && <tr><td colSpan={3} className="px-3 py-8 text-center text-tnr-cream/40">None.</td></tr>}</tbody></table>
    </div></Card>
  </div>;
}
