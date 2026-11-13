'use client';
import { useCallback, useEffect, useState } from 'react';
import { aGet } from './adminApi';

/* Search analytics — counts only. See app/api/admin/search-analytics/route.js
 * for what is and is not recorded. */

const th = 'px-3 py-2.5 text-left text-[11px] uppercase tracking-wider text-tnr-cream/50';
const td = 'px-3 py-2 text-sm';

function List({ title, note, rows, empty, valueLabel = 'Searches' }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-tnr-line">
      <div className="border-b border-tnr-line px-4 py-3">
        <p className="font-semibold text-tnr-cream">{title}</p>
        {note && <p className="text-xs text-tnr-cream/50">{note}</p>}
      </div>
      <table className="w-full">
        <thead><tr><th className={th}>{title.includes('categor') ? 'Category' : 'Term'}</th><th className={`${th} text-right`}>{valueLabel}</th></tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.term || r.type} className="border-t border-tnr-line/40">
              <td className={`${td} text-tnr-cream`}>{r.term || r.label}</td>
              <td className={`${td} text-right text-tnr-goldLight`}>{r.hits}</td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={2} className="px-3 py-6 text-center text-sm text-tnr-cream/40">{empty}</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

export default function SearchAnalyticsTab() {
  const [days, setDays] = useState(30);
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setD(null); setErr('');
    const r = await aGet(`/api/admin/search-analytics?days=${days}`);
    if (r?.ok) setD(r);
    else setErr([r?.message || 'Could not load search analytics.', r?.hint].filter(Boolean).join(' '));
  }, [days]);
  useEffect(() => { load(); }, [load]);

  const max = d ? Math.max(1, ...d.trend.map(t => t.searches)) : 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-tnr-cream">Search Analytics</h2>
          <p className="mt-1 max-w-2xl text-sm text-tnr-cream/50">
            What visitors look for on the site, and what they fail to find. Counts only — TNR does
            not record who searched.
          </p>
        </div>
        <select value={days} onChange={e => setDays(Number(e.target.value))}
          className="rounded-lg border border-tnr-line bg-black/30 px-3 py-2 text-sm text-tnr-cream">
          {[7, 30, 90].map(n => <option key={n} value={n}>Last {n} days</option>)}
        </select>
      </div>

      {err && <div className="card p-4 text-sm text-amber-200">{err}</div>}
      {!d && !err && <div className="card p-6 text-sm text-tnr-cream/50">Loading…</div>}

      {d && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              ['Searches', d.totals.searches],
              ['Found nothing', `${d.totals.zero_result} (${d.totals.zero_rate}%)`],
              ['Average response', d.totals.avg_ms == null ? '—' : `${d.totals.avg_ms} ms`],
              ['Results opened', d.totals.result_opens],
            ].map(([k, v]) => (
              <div key={k} className="card p-4">
                <p className="text-[11px] uppercase tracking-wider text-tnr-cream/50">{k}</p>
                <p className="mt-1 text-2xl font-bold text-tnr-goldLight">{v}</p>
              </div>
            ))}
          </div>

          <div className="card p-4">
            <p className="text-sm font-semibold text-tnr-cream">Searches per day</p>
            <div className="mt-3 flex h-24 items-end gap-[2px]" role="img" aria-label="Searches per day">
              {d.trend.map(t => (
                <div key={t.day} title={`${t.day}: ${t.searches}`} className="flex-1 rounded-t bg-tnr-gold/70"
                  style={{ height: `${Math.max(2, (t.searches / max) * 100)}%`, opacity: t.searches ? 1 : 0.2 }} />
              ))}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <List title="Most searched" rows={d.top_terms}
              note={`Shown once searched ${d.thresholds.term}+ times.`} empty="Not enough searches yet." />
            <List title="Searches with no results" rows={d.zero_terms}
              note="Content people wanted and did not find." empty="Nothing unanswered." />
            <List title="Most opened categories" rows={d.categories} valueLabel="Opens"
              note="Which kind of result people click." empty="No results opened yet." />
          </div>

          <p className="text-xs text-tnr-cream/40">
            Average response is the server&apos;s own search time. Searches that look like a phone number
            or an email address are never recorded. Data older than {d.thresholds.retention_days} days is deleted.
          </p>
        </>
      )}
    </div>
  );
}
