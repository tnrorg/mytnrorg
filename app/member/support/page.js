'use client';
import { useEffect, useState } from 'react';
import MemberShell from '@/components/member/MemberShell';
import { mGet, mPost } from '@/components/member/memberApi';
const C = { deep: '#063D2B', green: '#0B6B4F' };
const mont = { fontFamily: 'var(--font-mulish), Mulish, system-ui, sans-serif' };
const base = 'w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#0B6B4F] bg-white text-[#15231D]';
const CATS = ['Membership','Profile','CV Builder','Cover Letter','Membership Card','Certificate','Login','Technical Problem','General Inquiry'];

export default function Support() {
  const [tickets, setTickets] = useState(null);
  const [open, setOpen] = useState(null);
  const [thread, setThread] = useState(null);
  const [f, setF] = useState({ category: 'General Inquiry', subject: '', message: '' });
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => mGet('/api/member/support').then(r => r.ok && setTickets(r.tickets || []));
  useEffect(() => { load(); }, []);
  const openTicket = (t) => { setOpen(t); mGet('/api/member/support/' + t.id).then(r => r.ok && setThread(r)); };

  const create = async () => {
    if (!f.subject.trim() || !f.message.trim()) return;
    setBusy(true); const r = await mPost('/api/member/support', f); setBusy(false);
    if (r.ok) { setF({ category: 'General Inquiry', subject: '', message: '' }); load(); }
  };
  const send = async () => {
    if (!reply.trim()) return;
    setBusy(true); await mPost('/api/member/support/' + open.id, { message: reply }); setBusy(false);
    setReply(''); openTicket(open); load();
  };

  return (
    <MemberShell active="/member/support">
      <h1 style={{ ...mont, color: C.deep }} className="text-2xl font-black">Help &amp; Support</h1>
      <p className="mt-1 text-sm text-gray-500">Ask the TNR team for help. We reply through this page.</p>

      <div className="mt-6 grid lg:grid-cols-2 gap-5 items-start">
        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5">
          <h2 style={{ ...mont, color: C.deep }} className="text-sm font-black uppercase mb-3">New Request</h2>
          <select value={f.category} onChange={e => setF({ ...f, category: e.target.value })} className={base + ' mb-2'}>
            {CATS.map(c => <option key={c}>{c}</option>)}
          </select>
          <input placeholder="Subject" value={f.subject} onChange={e => setF({ ...f, subject: e.target.value })} className={base + ' mb-2'} />
          <textarea rows={5} placeholder="Describe your problem…" value={f.message}
            onChange={e => setF({ ...f, message: e.target.value })} className={base} />
          <button onClick={create} disabled={busy || !f.subject.trim() || !f.message.trim()}
            className="mt-3 w-full py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40"
            style={{ background: `linear-gradient(180deg,${C.green},${C.deep})` }}>Submit Request</button>
        </div>

        <div className="space-y-2">
          {tickets && !tickets.length && <p className="text-sm text-gray-400">You have no support requests yet.</p>}
          {(tickets || []).map(t => (
            <button key={t.id} onClick={() => openTicket(t)}
              className="w-full text-left rounded-2xl bg-white border border-gray-100 shadow-sm p-4 hover:shadow-md transition">
              <div className="flex justify-between gap-2">
                <span style={{ ...mont, color: C.deep }} className="font-bold text-sm">{t.subject}</span>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{t.status}</span>
              </div>
              <div className="text-[11px] text-gray-400 mt-1 font-mono">{t.ticket_no} · {t.category}</div>
            </button>
          ))}
        </div>
      </div>

      {open && thread && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4 bg-black/50" onClick={() => { setOpen(null); setThread(null); }}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] overflow-auto p-5" onClick={e => e.stopPropagation()}>
            <h3 style={{ ...mont, color: C.deep }} className="font-black">{thread.ticket.subject}</h3>
            <div className="text-[11px] text-gray-400 font-mono">{thread.ticket.ticket_no}</div>
            <div className="mt-4 space-y-3">
              {thread.messages.map(m => (
                <div key={m.id} className={`rounded-xl p-3 text-sm ${m.sender === 'member' ? 'bg-gray-50' : 'bg-[#0B6B4F0d]'}`}>
                  <div className="text-[11px] font-bold" style={{ color: m.sender === 'member' ? '#6B7280' : C.green }}>
                    {m.sender === 'member' ? 'You' : (m.sender_name || 'TNR Team')}
                  </div>
                  <p className="mt-1 whitespace-pre-line">{m.message}</p>
                </div>
              ))}
            </div>
            {thread.ticket.status !== 'closed' && (
              <div className="mt-4">
                <textarea rows={3} placeholder="Write a reply…" value={reply}
                  onChange={e => setReply(e.target.value)} className={base} />
                <button onClick={send} disabled={busy || !reply.trim()}
                  className="mt-2 w-full py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40"
                  style={{ background: `linear-gradient(180deg,${C.green},${C.deep})` }}>Send Reply</button>
              </div>
            )}
            <button onClick={() => { setOpen(null); setThread(null); }}
              className="mt-3 w-full py-2 rounded-xl text-sm border border-gray-200">Close</button>
          </div>
        </div>
      )}
    </MemberShell>
  );
}
