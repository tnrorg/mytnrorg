'use client';
import { useEffect, useState, useMemo } from 'react';
import { aGet, aPost } from './adminApi';
import { Card } from './ui';

// Committee ballot entry — one COMPLETE ballot per voter (all positions),
// exactly like the member voting flow.
export default function CommitteeVoteTab({ toast }) {
  const [data, setData] = useState(null);
  const [q, setQ] = useState('');
  const [voter, setVoter] = useState(null);
  const [picks, setPicks] = useState({});      // { [position_id]: candidate_id }
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);

  const load = () => aGet('/api/admin/committee-vote').then(r => { if (r.ok) setData(r); else toast(r.message || 'Forbidden', 'err'); });
  useEffect(() => { load(); }, []);

  const remaining = data?.remaining || [];
  const positions = data?.positions || [];
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return !s ? remaining.slice(0, 50) : remaining.filter(m => (m.full_name || '').toLowerCase().includes(s) || (m.mobile || '').includes(s)).slice(0, 50);
  }, [q, remaining]);

  const candsFor = (pid) => (data?.candidates || []).filter(c => String(c.position_id) === String(pid));
  const filledCount = positions.filter(p => picks[p.id]).length;
  const complete = positions.length > 0 && filledCount === positions.length;
  const ready = voter && complete;

  const candName = id => ((data?.candidates || []).find(c => c.id === id) || {}).name;

  async function submit() {
    setBusy(true);
    const selections = positions.map(p => ({ position_id: p.id, candidate_id: picks[p.id] }));
    const r = await aPost('/api/admin/committee-vote', { member_id: voter.id, selections });
    setBusy(false); setConfirm(false);
    if (!r.ok) return toast(r.message, 'err');
    setDone({ voter, receipt: r.receipt_code });
    setVoter(null); setPicks({}); setQ('');
    load();
  }

  if (!data) return <p className="text-tnr-cream/50">Loading…</p>;
  if (!data.election) return <Card><p className="text-tnr-cream/60">No active election.</p></Card>;

  return <div className="space-y-4 max-w-2xl">
    <div className="card p-3 text-xs text-tnr-cream/60 border-tnr-gold/40">
      🔒 Super Admin only. Each entry records one COMPLETE ballot — one candidate for every position —
      for a remaining eligible voter, and counts exactly like an online vote.
    </div>
    <div className="grid grid-cols-2 gap-3">
      <div className="stat"><div className="text-3xl font-black text-tnr-gold">{remaining.length}</div><div className="text-[11px] uppercase tracking-wider text-tnr-cream/50">Remaining Voters</div></div>
      <div className="stat"><div className="text-3xl font-black text-tnr-cream">{data.election.title}</div><div className="text-[11px] uppercase tracking-wider text-tnr-cream/50">Active Election</div></div>
    </div>

    <Card>
      <div className="label">1 · Select remaining voter</div>
      {voter ? (
        <div className="flex items-center justify-between rounded-xl border border-tnr-gold/40 bg-black/30 px-3 py-2">
          <span className="text-tnr-cream font-medium">{voter.full_name} <span className="text-tnr-cream/50 text-sm">· {voter.mobile}</span></span>
          <button className="text-tnr-goldLight text-sm hover:underline" onClick={() => { setVoter(null); setPicks({}); }}>change</button>
        </div>
      ) : (
        <>
          <input className="input" placeholder="Search name or number…" value={q} onChange={e => setQ(e.target.value)} />
          <div className="mt-2 max-h-52 overflow-auto rounded-xl border border-tnr-line divide-y divide-tnr-line/40">
            {filtered.map(m => <button key={m.id} onClick={() => setVoter(m)} className="w-full text-left px-3 py-2 hover:bg-white/5 text-sm">
              <span className="text-tnr-cream">{m.full_name}</span> <span className="text-tnr-cream/40">· {m.mobile}</span></button>)}
            {!filtered.length && <div className="px-3 py-3 text-tnr-cream/40 text-sm">No remaining voters match.</div>}
          </div>
        </>
      )}

      <div className="label mt-5">2 · Select one candidate for EVERY position</div>
      <div className="space-y-3">
        {positions.map(p => (
          <div key={p.id}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-semibold text-tnr-cream">{p.title}</span>
              {picks[p.id]
                ? <span className="text-xs text-tnr-gold font-semibold">✓ selected</span>
                : <span className="text-xs text-tnr-cream/40">required</span>}
            </div>
            <select className="input" value={picks[p.id] || ''} disabled={!voter}
              onChange={e => setPicks({ ...picks, [p.id]: e.target.value || undefined })}>
              <option value="">— choose candidate —</option>
              {candsFor(p.id).map(c => <option key={c.id} value={c.id}>{c.name}{c.symbol ? ` (${c.symbol})` : ''}</option>)}
            </select>
          </div>
        ))}
      </div>

      <div className="mt-4 h-1.5 rounded-full bg-black/40 overflow-hidden">
        <div className="h-full bg-tnr-gold transition-all" style={{ width: `${positions.length ? (filledCount / positions.length) * 100 : 0}%` }} />
      </div>
      <div className="text-xs text-tnr-cream/50 mt-1">{filledCount} of {positions.length} positions selected</div>

      <button className="btn-gold w-full mt-5 text-lg" disabled={!ready} onClick={() => setConfirm(true)}>
        {ready ? 'REVIEW & CONFIRM BALLOT' : `SELECT ALL ${positions.length} POSITIONS TO CONTINUE`}
      </button>
    </Card>

    {confirm && <div className="fixed inset-0 z-50 grid place-items-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setConfirm(false)}>
      <div className="card p-6 w-full max-w-sm animate-pop" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-tnr-goldLight mb-2 text-center">Confirm complete ballot</h3>
        <p className="text-sm text-tnr-cream/80 text-center mb-3">Ballot for <b className="text-tnr-cream">{voter?.full_name}</b></p>
        <div className="rounded-xl bg-black/30 border border-tnr-line divide-y divide-tnr-line/50 mb-3">
          {positions.map(p => (
            <div key={p.id} className="px-3 py-2 text-sm flex justify-between gap-3">
              <span className="text-tnr-cream/50">{p.title}</span>
              <span className="text-tnr-goldLight font-semibold text-right">{candName(picks[p.id])}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-tnr-cream/50 text-center">All {positions.length} votes are recorded together. This cannot be undone.</p>
        <div className="flex gap-3 mt-4"><button className="btn-ghost flex-1" onClick={() => setConfirm(false)}>Go Back</button>
          <button className="btn-gold flex-1" disabled={busy} onClick={submit}>{busy ? '…' : 'Confirm'}</button></div>
      </div>
    </div>}

    {done && <div className="fixed inset-0 z-50 grid place-items-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setDone(null)}>
      <div className="card p-6 w-full max-w-sm animate-pop text-center" onClick={e => e.stopPropagation()}>
        <div className="text-4xl mb-2">✅</div>
        <h3 className="text-lg font-bold text-tnr-goldLight">Complete ballot recorded</h3>
        <p className="text-sm text-tnr-cream/70 mt-1">{done.voter.full_name} is now marked as voted.</p>
        <div className="my-3 py-2 rounded-xl bg-black/30 border border-tnr-line"><div className="text-xs text-tnr-cream/50">Receipt</div><div className="font-black tracking-widest text-tnr-gold">{done.receipt}</div></div>
        <button className="btn-gold w-full" onClick={() => setDone(null)}>Enter another</button>
      </div>
    </div>}
  </div>;
}
