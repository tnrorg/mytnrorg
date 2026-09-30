'use client';
import { useCallback, useEffect, useState } from 'react';
import { aGet, aPost } from './adminApi';
import {
  APP_STATUSES, APP_STATUS_LABEL, APP_STATUS_TONE, ROUND_STATUSES,
  MOTIVATION_QUESTION, SNAPSHOT_FIELDS,
} from '@/lib/ucCoordinator';

const C = { deep: '#063D2B', green: '#0B6B4F', gold: '#C9A227' };
const input =
  'w-full rounded-xl border px-3 py-2 text-[14px] outline-none focus:ring-2 border-gray-200';

/* UC Coordinator recruitment — the committee's screen.
 *
 * Applications are grouped by Union Council, because that is the question the
 * committee is actually answering: not "who applied" but "who applied for
 * Stak, and is there anyone for Tormik". A flat list sorted by date hides the
 * Union Council with no candidates, which is the one needing attention.
 */
export default function UcCoordinatorTab({ toast }) {
  const [d, setD] = useState(null);
  const [loading, setLoading] = useState(true);
  const [roundId, setRoundId] = useState('');
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(null);       // the application being read

  const load = useCallback((rid) => {
    setLoading(true);
    aGet(`/api/admin/uc-coordinator${rid ? `?round_id=${rid}` : ''}`)
      .then(r => {
        setD(r || null);
        if (r?.ok) setRoundId(r.round_id || '');
      })
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const rounds = d?.rounds || [];
  const round = rounds.find(r => r.id === roundId) || null;
  const apps = d?.applications || [];
  const byUc = d?.by_uc || {};

  async function saveRound(form) {
    const r = await aPost('/api/admin/uc-coordinator', { action: 'save_round', ...form });
    if (!r?.ok) return toast?.(r?.message || 'Could not save.', 'err');
    toast?.(r.warning || 'Saved.', r.warning ? 'err' : 'ok');
    setEditing(null);
    load(r.round?.id || roundId);
  }

  async function setStatus(app, status) {
    const r = await aPost('/api/admin/uc-coordinator', {
      action: 'set_status', id: app.id, status,
    });
    if (!r?.ok) return toast?.(r?.message || 'Could not update.', 'err');
    toast?.(r.message, 'ok');
    /* Patch in place rather than reloading the whole list — the committee is
     * usually part-way down a long page and a reload throws away their place. */
    setD(prev => ({
      ...prev,
      applications: (prev.applications || []).map(a => a.id === app.id ? r.application : a),
    }));
    setOpen(o => (o && o.id === app.id ? r.application : o));
  }

  const ucNames = Object.keys(byUc).sort();

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[20px] font-black" style={{ color: C.deep }}>
            UC Coordinator Recruitment
          </h2>
          <p className="text-[13px] text-gray-500">
            One open call covering every Union Council. Only existing TNR members
            can apply, and each member can apply once per round.
          </p>
        </div>
        <button type="button" onClick={() => setEditing(round || { status: 'draft' })}
          className="rounded-xl px-4 py-2 text-[13.5px] font-bold text-white"
          style={{ background: C.green }}>
          {round ? 'Edit this round' : 'Start a round'}
        </button>
      </header>

      {loading && <p className="text-[14px] text-gray-500">Loading…</p>}

      {!loading && !!d && !d.ok && (
        <Note tone="err">
          {d.message || 'Could not load.'}{d.detail ? ` ${d.detail}` : ''}
        </Note>
      )}

      {!loading && d?.ok && !rounds.length && (
        <Note>
          No recruitment round has been created yet. Start one to open
          applications — members will see it in their portal, and an
          announcement goes up on the website automatically.
        </Note>
      )}

      {/* ── Round picker and state ── */}
      {rounds.length > 1 && (
        <select value={roundId} onChange={e => { setRoundId(e.target.value); load(e.target.value); }}
          className={`${input} mb-4 max-w-md`}>
          {rounds.map(r => (
            <option key={r.id} value={r.id}>
              {r.title} — {r.status}{r.closes_on ? ` (closes ${r.closes_on})` : ''}
            </option>
          ))}
        </select>
      )}

      {round && (
        <div className="mb-4 rounded-2xl border bg-white p-4" style={{ borderColor: '#E7EAE8' }}>
          <div className="flex flex-wrap items-center gap-2">
            <b className="text-[15px]" style={{ color: C.deep }}>{round.title}</b>
            <span className="rounded-lg px-2 py-0.5 text-[11px] font-black uppercase tracking-wider"
              style={round.status === 'open'
                ? { background: 'rgba(16,140,90,.14)', color: '#0A5B3A' }
                : { background: 'rgba(100,113,105,.12)', color: '#4A554E' }}>
              {round.status}
            </span>
            {round.closes_on && (
              <span className="text-[12.5px] text-gray-500">closes {round.closes_on}</span>
            )}
            <span className="ml-auto text-[13px] font-semibold" style={{ color: C.deep }}>
              {apps.length} {apps.length === 1 ? 'application' : 'applications'}
              {' · '}{ucNames.length} {ucNames.length === 1 ? 'Union Council' : 'Union Councils'}
            </span>
          </div>
          {round.status === 'open' && !round.announcement_id && (
            <Note tone="err">
              This round is open but no website announcement was published. Members
              can still apply from the portal. Save the round again to retry.
            </Note>
          )}
        </div>
      )}

      {/* ── Applications, grouped by Union Council ── */}
      {ucNames.map(uc => (
        <section key={uc} className="mb-5">
          <h3 className="mb-2 flex items-center gap-2 text-[14px] font-bold" style={{ color: C.deep }}>
            {uc}
            <span className="rounded-md px-1.5 py-0.5 text-[11px] font-semibold"
              style={{ background: '#EEF3F0', color: '#4A554E' }}>
              {byUc[uc].total}
            </span>
            {byUc[uc].selected > 0 && (
              <span className="rounded-md px-1.5 py-0.5 text-[11px] font-semibold"
                style={{ background: 'rgba(16,140,90,.16)', color: '#0A5B3A' }}>
                {byUc[uc].selected} selected
              </span>
            )}
          </h3>

          <div className="overflow-hidden rounded-2xl border bg-white" style={{ borderColor: '#E7EAE8' }}>
            {apps.filter(a => (a.union_council || 'Not recorded') === uc).map(a => {
              const tone = APP_STATUS_TONE[a.status] || APP_STATUS_TONE.new;
              return (
                <div key={a.id} className="flex flex-wrap items-center gap-3 border-b px-4 py-3 last:border-b-0"
                  style={{ borderColor: '#F0F3F1' }}>
                  <button type="button" onClick={() => setOpen(a)} className="min-w-0 flex-1 text-left">
                    <span className="block truncate text-[14px] font-semibold" style={{ color: '#15231D' }}>
                      {a.full_name}
                    </span>
                    <span className="block truncate text-[12px] text-gray-500">
                      {a.membership_id}
                      {a.reference_no ? ` · ${a.reference_no}` : ''}
                      {' · '}{new Date(a.submitted_at || a.created_at).toLocaleDateString('en-GB')}
                    </span>
                  </button>

                  <span className="rounded-lg px-2 py-1 text-[11px] font-black uppercase tracking-wider"
                    style={{ background: tone.bg, color: tone.fg }}>
                    {APP_STATUS_LABEL[a.status]}
                  </span>

                  <select value={a.status} onChange={e => setStatus(a, e.target.value)}
                    className="rounded-lg border px-2 py-1 text-[12.5px] border-gray-200">
                    {APP_STATUSES.map(([k, label]) => (
                      <option key={k} value={k}>{label}</option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {round && !apps.length && (
        <Note>No applications yet for this round.</Note>
      )}

      {editing && <RoundEditor round={editing} onCancel={() => setEditing(null)} onSave={saveRound} />}
      {open && <Application app={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function Note({ children, tone }) {
  return (
    <p className="mt-2 rounded-xl px-3 py-2 text-[13px] leading-relaxed"
      style={tone === 'err'
        ? { background: 'rgba(170,60,60,.09)', color: '#8A2F2F' }
        : { background: '#F6F8F7', color: '#5A6660' }}>
      {children}
    </p>
  );
}

function RoundEditor({ round, onCancel, onSave }) {
  const [f, setF] = useState({
    id: round.id,
    title: round.title || 'TNR Union Council Coordinator',
    summary: round.summary || '',
    status: round.status || 'draft',
    closes_on: round.closes_on || '',
  });
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-5">
        <h3 className="mb-3 text-[17px] font-black" style={{ color: C.deep }}>
          {round.id ? 'Edit round' : 'Start a recruitment round'}
        </h3>

        <label className="mb-3 block">
          <span className="mb-1 block text-xs text-gray-500">Title</span>
          <input value={f.title} onChange={e => set('title', e.target.value)} className={input} />
        </label>

        <label className="mb-3 block">
          <span className="mb-1 block text-xs text-gray-500">
            What members see above the form
          </span>
          <textarea rows={3} value={f.summary} onChange={e => set('summary', e.target.value)}
            className={input}
            placeholder="Applications are invited from members wishing to coordinate TNR activity in their Union Council." />
        </label>

        <div className="mb-3 grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs text-gray-500">Status</span>
            <select value={f.status} onChange={e => set('status', e.target.value)} className={input}>
              {ROUND_STATUSES.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-gray-500">Closing date</span>
            <input type="date" value={f.closes_on || ''} onChange={e => set('closes_on', e.target.value)}
              className={input} />
          </label>
        </div>

        <p className="mb-4 rounded-xl px-3 py-2 text-[12.5px] leading-relaxed"
          style={{ background: '#F6F8F7', color: '#5A6660' }}>
          Setting this to <b>Open</b> publishes an announcement on the website
          linking to the application page, and shows the form to every member.
          Closing it retires that announcement. Only one round can be open at a time.
        </p>

        <div className="flex gap-2">
          <button type="button" onClick={onCancel}
            className="flex-1 rounded-xl border px-4 py-2.5 text-[14px] font-bold"
            style={{ borderColor: '#DDE3DF', color: '#3A4842' }}>
            Cancel
          </button>
          <button type="button" onClick={() => onSave(f)}
            className="flex-1 rounded-xl px-4 py-2.5 text-[14px] font-bold text-white"
            style={{ background: C.green }}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

/* One application, as the member submitted it.
 *
 * The details shown are the SNAPSHOT stored on the application, not a live
 * read of the member record — so the committee reads what the applicant
 * confirmed on the day, which is the thing they actually signed up to. */
function Application({ app, onClose }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-[18px] font-black" style={{ color: C.deep }}>{app.full_name}</h3>
            <p className="text-[12.5px] text-gray-500">
              {app.reference_no ? `${app.reference_no} · ` : ''}
              submitted {new Date(app.submitted_at || app.created_at).toLocaleString('en-GB')}
            </p>
          </div>
          <button type="button" onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-[13px] font-bold" style={{ color: '#4A554E' }}>
            Close
          </button>
        </div>

        <dl className="mb-4 divide-y rounded-xl border" style={{ borderColor: '#EEF1EF' }}>
          {SNAPSHOT_FIELDS.map(([k, label]) => (
            <div key={k} className="flex flex-wrap gap-x-3 px-3 py-2">
              <dt className="w-full text-[11px] uppercase tracking-wide text-gray-400 sm:w-52">{label}</dt>
              <dd className="flex-1 text-[13.5px]" style={{ color: '#15231D' }}>
                {app[k] || <span className="text-gray-400">Not recorded</span>}
              </dd>
            </div>
          ))}
        </dl>

        <h4 className="text-[12px] font-bold uppercase tracking-wide text-gray-400">
          {MOTIVATION_QUESTION}
        </h4>
        <p className="mt-1 whitespace-pre-wrap text-[14px] leading-relaxed" style={{ color: '#2C3A34' }}>
          {app.motivation}
        </p>

        {app.commitment_accepted && (
          <p className="mt-4 rounded-xl px-3 py-2 text-[12.5px] leading-relaxed"
            style={{ background: 'rgba(16,140,90,.08)', color: '#0A5B3A' }}>
            ✓ {app.commitment_text}
          </p>
        )}

        {app.reviewed_by && (
          <p className="mt-3 text-[12px] text-gray-400">
            Last reviewed by {app.reviewed_by}
            {app.reviewed_at ? ` on ${new Date(app.reviewed_at).toLocaleDateString('en-GB')}` : ''}
          </p>
        )}
      </div>
    </div>
  );
}
