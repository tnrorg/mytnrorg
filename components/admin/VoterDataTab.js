'use client';
import { useEffect, useState } from 'react';
import { aGet } from './adminApi';
import { exportExcel } from './exporters';

// SUPER ADMIN ONLY — every member who has cast a ballot, with full details
// including the candidate chosen for each position.
export default function VoterDataTab({ toast }) {
  const [voters, setVoters] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const [err, setErr] = useState('');
  const load = () => aGet('/api/admin/voter-data?t=' + Date.now())
    .then(r => { if (r.ok) { setVoters(r.voters || []); setErr(r.note || ''); } else setErr(r.detail || r.message || 'Request failed'); setLoading(false); });
  useEffect(() => { load(); const id = setInterval(load, 20000); return () => clearInterval(id); }, []);

  const q = search.trim().toLowerCase();
  const rows = q
    ? voters.filter(v => [v.full_name, v.member_code, v.email, v.mobile, v.village, v.union_name, v.receipt_code]
        .some(x => String(x || '').toLowerCase().includes(q)))
    : voters;

  const fmt = (d) => d ? new Date(d).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 flex-wrap">
        <div className="flex-1 min-w-[220px]">
          <h2 className="text-xl font-bold text-tnr-cream">Voter Data</h2>
          <p className="text-sm text-tnr-cream/50 mt-1">
            Members who have cast their ballot — <b className="text-tnr-goldLight">{voters.length}</b> so far.
            Includes each voter&rsquo;s chosen candidates. Visible to Super Admins only — handle with care.
          </p>
        </div>
        <button className="btn-ghost !py-2 text-sm"
          onClick={() => exportExcel(rows.map(v => ({
            'TNR-MN': v.member_code, Name: v.full_name, Gender: v.gender, Email: v.email,
            Mobile: v.mobile, Village: v.village, Union: v.union_name,
            'Voted At': fmt(v.voted_at), Positions: v.positions_voted, Receipt: v.receipt_code,
            Choices: (v.choices || []).map(c => `${c.position}: ${c.candidate}`).join(' | '),
          })), 'Voter Data', 'tnr-voter-data.xlsx')}>
          ⬇ Export Excel
        </button>
      </div>

      {err && <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm">{err}</div>}

      <input className="input max-w-sm" placeholder="Search name / code / email / village / receipt"
        value={search} onChange={e => setSearch(e.target.value)} />

      <div className="rounded-2xl border border-tnr-line overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-tnr-cream/50 border-b border-tnr-line">
              <th className="px-3 py-2.5">TNR-MN</th><th className="px-3 py-2.5">Name</th>
              <th className="px-3 py-2.5">Gender</th><th className="px-3 py-2.5">Email</th>
              <th className="px-3 py-2.5">Mobile</th><th className="px-3 py-2.5">Village</th>
              <th className="px-3 py-2.5">Voted At</th><th className="px-3 py-2.5">Choices</th>
              <th className="px-3 py-2.5">Receipt</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(v => (
              <tr key={v.member_code || v.receipt_code} className="border-t border-tnr-line/40 hover:bg-white/5">
                <td className="px-3 py-2 text-tnr-gold/90 font-mono text-xs whitespace-nowrap">{v.member_code || '—'}</td>
                <td className="px-3 py-2 font-medium text-tnr-cream">{v.full_name}</td>
                <td className="px-3 py-2 text-tnr-cream/70">{v.gender || '—'}</td>
                <td className="px-3 py-2 text-tnr-cream/70">{v.email || '—'}</td>
                <td className="px-3 py-2 text-tnr-cream/70 whitespace-nowrap">{v.mobile || '—'}</td>
                <td className="px-3 py-2 text-tnr-cream/70">{v.village || '—'}</td>
                <td className="px-3 py-2 text-tnr-goldLight whitespace-nowrap">{fmt(v.voted_at)}</td>
                <td className="px-3 py-2">
                  <div className="space-y-0.5 min-w-[220px]">
                    {(v.choices || []).map((c, i) => (
                      <div key={i} className="text-xs">
                        <span className="text-tnr-cream/40">{c.position}:</span>{' '}
                        <span className="text-tnr-cream font-semibold">{c.candidate}</span>
                      </div>
                    ))}
                    {!(v.choices || []).length && <span className="text-tnr-cream/40 text-xs">—</span>}
                  </div>
                </td>
                <td className="px-3 py-2 font-mono text-xs text-tnr-cream/60">{v.receipt_code || '—'}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr><td colSpan={9} className="px-3 py-8 text-center text-tnr-cream/40">
                {loading ? 'Loading…' : q ? 'No voters match your search.' : 'No votes have been cast yet.'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
