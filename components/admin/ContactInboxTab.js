'use client';
import { useEffect, useState } from 'react';
import { aGet, aPatch, aDel } from './adminApi';
import { Card } from './ui';
import { KINDS, STATUSES, STATUS_LABEL, kindLabel } from '@/lib/contact';

const TONE = {
  new:      'bg-amber-500/15 text-amber-300 border-amber-500/30',
  read:     'bg-blue-500/15 text-blue-300 border-blue-500/30',
  resolved: 'bg-green-500/15 text-green-300 border-green-500/30',
  spam:     'bg-gray-500/15 text-gray-400 border-gray-500/30',
};

const fmt = (d) => (d ? new Date(d).toLocaleString('en-GB', {
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
}) : '—');

/* Messages from the four public contact forms.
 *
 * Opening a message marks it read, so the "new" count means what it says
 * rather than needing to be maintained by hand.
 */
export default function ContactInboxTab({ toast }) {
  const [rows, setRows] = useState([]);
  const [counts, setCounts] = useState({ total: 0, new: 0 });
  const [kind, setKind] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  const load = () => {
    const q = new URLSearchParams({ kind, status, search });
    setLoading(true);
    aGet('/api/admin/contact?' + q).then(r => {
      setLoading(false);
      if (r?.ok) { setRows(r.messages || []); setCounts(r.counts || {}); setErr(''); }
      else setErr(r?.detail || r?.message || 'Could not load messages.');
    }).catch(e => { setLoading(false); setErr(e.message || 'Request failed.'); });
  };
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t);
    /* eslint-disable-next-line */ }, [kind, status, search]);

  async function setStatusFor(m, next) {
    const r = await aPatch('/api/admin/contact/' + m.id, { status: next });
    if (!r.ok) return toast?.(r.message || 'Failed', 'err');
    toast?.(`Marked ${STATUS_LABEL[next].toLowerCase()}`, 'ok');
    load();
  }

  async function saveNote(m, notes) {
    const r = await aPatch('/api/admin/contact/' + m.id, { admin_notes: notes });
    toast?.(r.ok ? 'Note saved' : (r.message || 'Failed'), r.ok ? 'ok' : 'err');
    if (r.ok) load();
  }

  async function remove(m) {
    if (!confirm(`Delete this message from ${m.name}?\n\nThis cannot be undone. ` +
      `If it is unwanted rather than abusive, mark it as spam instead.`)) return;
    const r = await aDel('/api/admin/contact/' + m.id);
    if (!r?.ok) return toast?.(r?.message || 'Could not delete.', 'err');
    toast?.('Message deleted', 'ok');
    load();
  }

  // Opening an unread message marks it read — the natural moment, and it means
  // nobody has to remember to do it.
  function toggle(m) {
    const next = openId === m.id ? null : m.id;
    setOpenId(next);
    if (next && m.status === 'new') setStatusFor(m, 'read');
  }

  const chip = (active) => `px-3 py-1.5 rounded-lg text-xs border transition ${active
    ? 'bg-tnr-gold text-tnr-black border-tnr-gold font-semibold'
    : 'border-tnr-line text-tnr-cream/60 hover:bg-white/5'}`;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-tnr-cream">Contact Inbox</h2>
        <p className="text-sm text-tnr-cream/50 mt-1">
          Messages from Contact Us, Feedback, Complaints and Technical Support.
          {counts.new > 0 && <span className="text-tnr-gold font-semibold"> {counts.new} unread.</span>}
        </p>
      </div>

      {err && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-200 text-sm space-y-1">
          <div className="font-semibold">Contact inbox not ready</div>
          <div className="text-red-200/80 text-xs">{err}</div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 items-center">
        <input className="input max-w-xs" placeholder="Search name / email / subject"
          value={search} onChange={e => setSearch(e.target.value)} />
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => setKind('')} className={chip(kind === '')}>All forms</button>
          {KINDS.map(k => (
            <button key={k.key} onClick={() => setKind(k.key)} className={chip(kind === k.key)}>{k.label}</button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => setStatus('')} className={chip(status === '')}>Any status</button>
          {STATUSES.map(s => (
            <button key={s} onClick={() => setStatus(s)} className={chip(status === s)}>{STATUS_LABEL[s]}</button>
          ))}
        </div>
      </div>

      {!rows.length && !err && (
        <Card><div className="text-sm text-tnr-cream/40 text-center py-8">
          {loading ? 'Loading messages…' : 'No messages match these filters.'}
        </div></Card>
      )}

      {rows.map(m => {
        const open = openId === m.id;
        return (
          <Card key={m.id}>
            <div className="flex flex-wrap items-center gap-2">
              <button className="font-bold text-tnr-cream text-left" onClick={() => toggle(m)}>
                {m.subject || '(no subject)'}
              </button>
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold border ${TONE[m.status] || ''}`}>
                {STATUS_LABEL[m.status] || m.status}
              </span>
              <span className="text-[11px] text-tnr-cream/50">{kindLabel(m.kind)}</span>
              <span className="text-[11px] text-tnr-cream/50">· {m.name}</span>
              {m.membership_id && (
                <span className="text-[11px] font-mono text-tnr-gold/80">{m.membership_id}</span>
              )}
              <span className="text-[11px] text-tnr-cream/40 ml-auto">{fmt(m.created_at)}</span>
              <button className="btn-ghost !py-1 !px-3 text-xs" onClick={() => toggle(m)}>
                {open ? 'Collapse' : 'Open'}
              </button>
            </div>

            {open && (
              <div className="mt-4 space-y-4">
                <div className="flex flex-wrap gap-4 text-xs text-tnr-cream/70">
                  {m.email && <span>✉ <a href={`mailto:${m.email}`} className="hover:underline">{m.email}</a></span>}
                  {m.mobile && <span>☎ <a href={`tel:${m.mobile}`} className="hover:underline">{m.mobile}</a></span>}
                  {m.handled_by && <span className="text-tnr-cream/40">Last handled by {m.handled_by} · {fmt(m.handled_at)}</span>}
                </div>

                <div className="rounded-xl bg-black/25 p-4 text-sm text-tnr-cream/85 whitespace-pre-wrap leading-relaxed">
                  {m.message}
                </div>

                <label className="block">
                  <span className="label">Internal note (not shown to the sender)</span>
                  <textarea className="input" rows={3} defaultValue={m.admin_notes || ''}
                    onBlur={e => e.target.value !== (m.admin_notes || '') && saveNote(m, e.target.value)} />
                </label>

                <div className="flex flex-wrap gap-2">
                  {m.email && (
                    <a className="btn-gold !py-1.5 !px-4 text-xs"
                      href={`mailto:${m.email}?subject=${encodeURIComponent('Re: ' + (m.subject || 'Your message to TNR'))}`}>
                      Reply by email
                    </a>
                  )}
                  {m.status !== 'resolved' && (
                    <button className="btn-ghost !py-1.5 !px-4 text-xs" onClick={() => setStatusFor(m, 'resolved')}>
                      Mark resolved
                    </button>
                  )}
                  {m.status !== 'spam' && (
                    <button className="btn-ghost !py-1.5 !px-4 text-xs" onClick={() => setStatusFor(m, 'spam')}>
                      Mark spam
                    </button>
                  )}
                  {/* Super Admin only, enforced on the server. Shown to
                      everyone so the rule is visible rather than a mystery. */}
                  <button className="text-xs text-red-400 hover:underline ml-auto" onClick={() => remove(m)}>
                    Delete
                  </button>
                </div>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
