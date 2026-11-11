'use client';
import { useCallback, useEffect, useState } from 'react';
import { aGet, aPatch, aPost } from './adminApi';

/* ── Possible duplicate registrations ────────────────────────────────────────
 *
 * The queue shows pairs of records that scored high enough to be worth a
 * human look, side by side, with the arithmetic that produced the score.
 *
 * The design brief for this screen is one sentence: a reviewer must never be
 * able to act on the number alone. So the score is never shown without its
 * reasons, the fields that disagree are marked as clearly as the ones that
 * agree, how much of the comparison was even possible is stated outright, and
 * confirming a duplicate demands a written note. Two men in Roundu called
 * Muhammad Ali, both 24, both at COMSATS, will appear here at a very high
 * score and are not the same person — the screen has to make that outcome easy
 * to reach.
 */

const TABS = [
  ['open', 'Needs review'],
  ['confirmed_duplicate', 'Confirmed'],
  ['not_duplicate', 'Not duplicates'],
  ['dismissed', 'Dismissed'],
  ['all', 'All'],
];

const FIELDS = [
  ['full_name', 'Name'],
  ['village', 'Village'],
  ['union_council', 'Union Council'],
  ['age', 'Age'],
  ['university', 'University / employer'],
  ['education', 'Education'],
  ['profession', 'Field'],
];

const same = (a, b) =>
  a != null && b != null && String(a).trim() !== '' &&
  String(a).trim().toLowerCase() === String(b).trim().toLowerCase();

function RiskPill({ risk, score }) {
  const style = risk === 'high'
    ? 'bg-red-50 text-red-700 ring-red-200'
    : 'bg-amber-50 text-amber-800 ring-amber-200';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${style}`}>
      {score}% · {risk === 'high' ? 'High similarity' : 'Possible'}
    </span>
  );
}

function Side({ s }) {
  if (s.missing) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-3 text-sm text-gray-500">
        This record has been deleted.
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
          {s.kind === 'member' ? 'Member' : 'Application'}
        </span>
        <span className="font-mono text-[11px] text-gray-500">{s.label || '—'}</span>
      </div>
      <p className="mt-1 text-[15px] font-semibold text-gray-900">{s.full_name || '—'}</p>
      <p className="mt-0.5 text-xs text-gray-500">
        {s.status}
        {s.created_at ? ` · ${new Date(s.created_at).toLocaleDateString()}` : ''}
      </p>
    </div>
  );
}

function Flag({ f, onReview, busy }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const L = f.left, R = f.right;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <RiskPill risk={f.risk} score={f.score} />
        <div className="flex items-center gap-2 text-xs text-gray-500">
          {/* How much of the comparison was actually possible. A 95% built on
              three fields is a different claim from a 95% built on seven, and
              the reviewer is entitled to know which one they are looking at. */}
          <span title="How much of the comparison was possible — both records had to carry a field for it to count">
            {f.coverage}% of fields comparable
          </span>
          {f.review_status !== 'open' && (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 font-semibold text-gray-600">
              {f.review_status.replace(/_/g, ' ')}
            </span>
          )}
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Side s={L} />
        <Side s={R} />
      </div>

      {/* Field by field. Agreements and disagreements get equal billing. */}
      <div className="mt-3 overflow-hidden rounded-xl border border-gray-200">
        <table className="w-full text-sm">
          <tbody>
            {FIELDS.map(([key, label]) => {
              const a = L?.[key], b = R?.[key];
              const both = a != null && String(a).trim() && b != null && String(b).trim();
              const hit = same(a, b);
              return (
                <tr key={key} className="border-b border-gray-100 last:border-0">
                  <td className="w-40 bg-gray-50 px-3 py-2 text-xs font-medium text-gray-500">{label}</td>
                  <td className={`px-3 py-2 ${hit ? 'font-semibold text-emerald-800' : 'text-gray-700'}`}>
                    {a ?? <span className="text-gray-300">—</span>}
                  </td>
                  <td className={`px-3 py-2 ${hit ? 'font-semibold text-emerald-800' : 'text-gray-700'}`}>
                    {b ?? <span className="text-gray-300">—</span>}
                  </td>
                  <td className="w-24 px-3 py-2 text-right text-xs">
                    {!both ? <span className="text-gray-400">not compared</span>
                      : hit ? <span className="text-emerald-700">match</span>
                      : <span className="text-gray-500">differs</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <button type="button" onClick={() => setOpen(o => !o)}
        className="mt-2 text-xs font-semibold text-emerald-800 underline">
        {open ? 'Hide' : 'Show'} how this score was calculated
      </button>

      {open && (
        <ul className="mt-2 space-y-1 rounded-xl bg-gray-50 p-3 text-xs text-gray-600">
          {(f.reasons || []).map((r, i) => (
            <li key={i} className="flex items-start justify-between gap-3">
              <span>
                <strong className="text-gray-800">{r.label}</strong>
                {r.detail ? ` — ${r.detail}` : ''}
              </span>
              {r.of ? <span className="whitespace-nowrap font-mono">{r.points}/{r.of}</span> : null}
            </li>
          ))}
          {!f.reasons?.length && <li>No field agreed.</li>}
          <li className="border-t border-gray-200 pt-1 text-[11px] text-gray-500">
            A score measures resemblance, not identity. Two different people can
            share a name, a village and an age — confirm by contacting them
            before treating this as a duplicate.
          </li>
        </ul>
      )}

      {f.review_status === 'open' ? (
        <div className="mt-3 border-t border-gray-100 pt-3">
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
            placeholder="How was this checked? Who did you speak to? (required to confirm a duplicate)"
            className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:border-emerald-600" />
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" disabled={busy}
              onClick={() => onReview(f.id, 'confirmed_duplicate', note)}
              className="rounded-xl bg-red-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
              Same person
            </button>
            <button type="button" disabled={busy}
              onClick={() => onReview(f.id, 'not_duplicate', note)}
              className="rounded-xl bg-emerald-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
              Different people
            </button>
            <button type="button" disabled={busy}
              onClick={() => onReview(f.id, 'dismissed', note)}
              className="rounded-xl border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 disabled:opacity-50">
              Can't tell — set aside
            </button>
          </div>
          {/* Said plainly, because the buttons above look like they might do
              more than they do — and a reviewer who believes "Same person"
              suspends an account would use it far more freely than one who
              knows it only records an opinion. */}
          <p className="mt-2 text-[11px] text-gray-500">
            These record your verdict only. No membership is suspended, deleted
            or merged — do that from Members or Applications.
          </p>
        </div>
      ) : (
        <div className="mt-3 border-t border-gray-100 pt-2 text-xs text-gray-500">
          {f.reviewed_by ? `Reviewed by ${f.reviewed_by}` : 'Reviewed'}
          {f.reviewed_at ? ` on ${new Date(f.reviewed_at).toLocaleDateString()}` : ''}
          {f.review_note ? ` — ${f.review_note}` : ''}
        </div>
      )}
    </div>
  );
}

export default function DuplicatesTab({ toast }) {
  const [tab, setTab] = useState('open');
  const [flags, setFlags] = useState([]);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const r = await aGet(`/api/admin/duplicates?status=${tab}`);
      setFlags(r.flags || []);
      setCounts(r.counts || {});
    } catch (e) {
      setErr(e?.message || 'Could not load the queue.');
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  async function onReview(id, review_status, note) {
    if (review_status === 'confirmed_duplicate' && !note.trim()) {
      toast?.('Write how you confirmed this first.', 'error');
      return;
    }
    setBusy(true);
    try {
      await aPatch('/api/admin/duplicates', { id, review_status, note });
      toast?.('Review saved.');
      await load();
    } catch (e) {
      toast?.(e?.message || 'Could not save the review.', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function rescan() {
    setBusy(true);
    try {
      const r = await aPost('/api/admin/duplicates', { rescan: true });
      toast?.(`Checked ${r.scanned} application${r.scanned === 1 ? '' : 's'}, ${r.flagged} flagged.`);
      await load();
    } catch (e) {
      toast?.(e?.message || 'Rescan failed.', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Possible duplicate registrations</h2>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">
            Email addresses and mobile numbers are already unique, so the same
            person cannot register twice with the same details. This finds the
            case that slips through — one person registering again with a new
            email and a new number. Everything here is a suggestion for you to
            check, never a decision.
          </p>
        </div>
        <button type="button" onClick={rescan} disabled={busy}
          className="rounded-xl border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 disabled:opacity-50">
          Re-check pending applications
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {TABS.map(([k, label]) => (
          <button key={k} type="button" onClick={() => setTab(k)}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
              tab === k ? 'bg-emerald-800 text-white' : 'bg-gray-100 text-gray-700'}`}>
            {label}{counts[k] != null ? ` (${counts[k]})` : ''}
          </button>
        ))}
      </div>

      {err && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{err}</div>
      )}
      {loading && <p className="text-sm text-gray-500">Loading…</p>}
      {!loading && !flags.length && !err && (
        <p className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
          Nothing here.
        </p>
      )}

      <div className="space-y-4">
        {flags.map(f => <Flag key={f.id} f={f} onReview={onReview} busy={busy} />)}
      </div>
    </div>
  );
}
