'use client';
import { useEffect, useState } from 'react';
import { aGet } from './adminApi';
import { Card } from './ui';
export default function LogsTab() {
  const [logs, setLogs] = useState([]); const [filter, setFilter] = useState('');
  useEffect(() => { aGet('/api/admin/logs' + (filter ? '?action=' + filter : '')).then(r => r.ok && setLogs(r.logs)); }, [filter]);
  const actions = ['','MEMBER_ADDED','MEMBER_APPROVED','VOTER_LIST_LOCKED','OTP_SENT','OTP_VERIFIED','VOTE_SUBMITTED','DUPLICATE_VOTE_ATTEMPT','RESULT_PUBLISHED','ADMIN_LOGIN'];
  return <div className="space-y-3">
    <select className="input max-w-xs" value={filter} onChange={e => setFilter(e.target.value)}>{actions.map(a => <option key={a} value={a}>{a || 'All actions'}</option>)}</select>
    <Card className="!p-0 overflow-hidden"><div className="overflow-auto max-h-[70vh]">
      <table className="w-full text-sm"><thead className="bg-black/30 sticky top-0"><tr className="text-tnr-cream/60 text-left">
        <th className="px-3 py-2">Action</th><th className="px-3 py-2">Actor</th><th className="px-3 py-2">Details</th><th className="px-3 py-2">Time</th></tr></thead>
        <tbody>{logs.map(l => <tr key={l.id} className="border-t border-tnr-line/40">
          <td className="px-3 py-2"><span className="text-tnr-goldLight font-medium">{l.action}</span></td>
          <td className="px-3 py-2 text-tnr-cream/70">{l.actor}</td><td className="px-3 py-2 text-tnr-cream/60">{l.details}</td>
          <td className="px-3 py-2 text-tnr-cream/40 whitespace-nowrap">{new Date(l.created_at).toLocaleString()}</td></tr>)}
          {!logs.length && <tr><td colSpan={4} className="px-3 py-8 text-center text-tnr-cream/40">No logs.</td></tr>}</tbody></table>
    </div></Card>
  </div>;
}
