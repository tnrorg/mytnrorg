'use client';
import { useEffect, useState } from 'react';
import { aGet, aPost, aPatch, aDel } from './adminApi';
import { Card, Field } from './ui';

const MAX = 160;
const EMPTY = { text: '', href: '', active: true, sort_order: 0, starts_at: '', ends_at: '' };

/** Datetime-local wants "YYYY-MM-DDTHH:mm"; Postgres returns a full ISO string. */
const toLocal = (iso) => (iso ? String(iso).slice(0, 16) : '');

export default function AnnouncementsTab({ toast }) {
  const [items, setItems] = useState(null);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () =>
    aGet('/api/admin/announcements').then(r => {
      if (r.ok) setItems(r.items || []);
      else toast?.(r.message || r.hint || 'Could not load announcements.', 'err');
    });

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const set = k => e =>
    setForm(s => ({ ...s, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  async function save() {
    if (!form.text.trim()) return toast?.('Enter the announcement text.', 'err');
    setBusy(true);
    const body = {
      ...form,
      starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null,
      ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
    };
    const r = form.id
      ? await aPatch('/api/admin/announcements/' + form.id, body)
      : await aPost('/api/admin/announcements', body);
    setBusy(false);
    if (!r.ok) return toast?.(r.message || 'Could not save.', 'err');
    toast?.('Saved.');
    setForm(null); load();
  }

  async function remove(a) {
    if (!confirm(`Delete this announcement?\n\n"${a.text}"`)) return;
    const r = await aDel('/api/admin/announcements/' + a.id);
    if (!r.ok) return toast?.(r.message || 'Could not delete.', 'err');
    toast?.('Deleted.'); load();
  }

  async function toggle(a) {
    const r = await aPatch('/api/admin/announcements/' + a.id, { active: !a.active });
    if (!r.ok) return toast?.(r.message || 'Could not update.', 'err');
    load();
  }

  if (!items) return <Card><div className="text-sm text-tnr-cream/60">Loading…</div></Card>;

  const live = items.filter(a => a.active);

  return (
    <div className="space-y-4 max-w-3xl">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-black text-tnr-cream">Announcements</h3>
            <p className="text-sm text-tnr-cream/60 mt-1">
              Scrolling notice strip on the home page, between the hero and the statistics.
              Lines loop continuously in the order below.
            </p>
          </div>
          <button onClick={() => setForm({ ...EMPTY, sort_order: items.length + 1 })}
            className="px-4 py-2 rounded-xl text-sm font-bold bg-tnr-gold text-tnr-green">
            + Add
          </button>
        </div>

        {!live.length && (
          <p className="mt-3 rounded-lg px-3 py-2 text-[12px]"
            style={{ background: 'rgba(200,154,43,.12)', color: '#E4C25B' }}>
            No active announcements — the strip is hidden on the home page.
          </p>
        )}
      </Card>

      {form && (
        <Card>
          <h3 className="font-black text-tnr-cream mb-3">{form.id ? 'Edit' : 'New'} announcement</h3>

          <Field label={`Text (${(form.text || '').length}/${MAX})`}>
            <input className="input" value={form.text} onChange={set('text')} maxLength={MAX}
              placeholder="Welcome to the TNR Digital Community Platform" />
          </Field>
          <p className="-mt-2 mb-3 text-[11px] text-tnr-cream/40">
            Keep it short — it has to be readable while moving.
          </p>

          <Field label="Link (optional)">
            <input className="input" value={form.href || ''} onChange={set('href')}
              placeholder="/membership/apply" />
          </Field>
          <p className="-mt-2 mb-3 text-[11px] text-tnr-cream/40">
            A path like <code>/membership/apply</code>, or a full https:// address.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Show from (optional)">
              <input type="datetime-local" className="input"
                value={toLocal(form.starts_at)} onChange={set('starts_at')} />
            </Field>
            <Field label="Hide after (optional)">
              <input type="datetime-local" className="input"
                value={toLocal(form.ends_at)} onChange={set('ends_at')} />
            </Field>
          </div>
          <p className="-mt-2 text-[11px] text-tnr-cream/40">
            Leave both blank for a permanent line. Dates let an event notice remove itself.
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-4">
            <Field label="Order">
              <input type="number" className="input w-24" value={form.sort_order} onChange={set('sort_order')} />
            </Field>
            <label className="flex items-center gap-2 text-sm text-tnr-cream/80 pt-4">
              <input type="checkbox" checked={form.active !== false} onChange={set('active')} />
              Active
            </label>
          </div>

          <div className="mt-4 flex gap-3">
            <button onClick={save} disabled={busy}
              className="px-5 py-2.5 rounded-xl text-sm font-bold bg-tnr-gold text-tnr-green disabled:opacity-40">
              {busy ? 'Saving…' : 'Save'}
            </button>
            <button onClick={() => setForm(null)}
              className="text-sm text-tnr-cream/60 hover:text-tnr-cream hover:underline">Cancel</button>
          </div>
        </Card>
      )}

      <Card>
        {!items.length && <div className="text-sm text-tnr-cream/40 py-4 text-center">Nothing yet.</div>}
        <ul className="divide-y divide-tnr-line/40">
          {items.map(a => (
            <li key={a.id} className="flex flex-wrap items-center gap-3 py-3">
              <span className="w-8 shrink-0 text-center font-mono text-xs text-tnr-cream/40">{a.sort_order}</span>
              <span className={`min-w-0 flex-1 text-sm ${a.active ? 'text-tnr-cream' : 'text-tnr-cream/35 line-through'}`}>
                {a.text}
                {a.href && <span className="ml-2 font-mono text-[11px] text-tnr-goldLight">→ {a.href}</span>}
              </span>
              {(a.starts_at || a.ends_at) && (
                <span className="text-[11px] text-tnr-cream/40">scheduled</span>
              )}
              <button onClick={() => toggle(a)}
                className="text-xs text-tnr-cream/60 hover:underline">{a.active ? 'Hide' : 'Show'}</button>
              <button onClick={() => setForm({ ...a, href: a.href || '' })}
                className="text-xs text-tnr-goldLight hover:underline">Edit</button>
              <button onClick={() => remove(a)}
                className="text-xs text-red-400 hover:underline">Delete</button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
