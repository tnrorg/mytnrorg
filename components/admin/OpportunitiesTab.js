'use client';
import { useEffect, useState } from 'react';
import { aGet, aPost, aDel } from './adminApi';
import { Card } from './ui';
import OpportunityEditor from './opportunities/OpportunityEditor';
import ApplicationsView from './opportunities/ApplicationsView';
import {
  CATEGORIES, ADMIN_STATUSES, STATUS_LABEL, categoryLabel, fmtDate,
} from '@/lib/opportunities';

const BLANK = {
  title: '', category: 'Scholarship', category_other: '', organization: '',
  cover_url: '', cover_data: '', short_description: '', deadline: '', closes_at: '',
  full_description: '', eligibility: '', benefits: '', duration: '', location: '',
  important_dates: '', instructions: '', required_documents: '', terms: '',
  additional_info: '', application_type: 'none', apply_url: '', pinned: false,
};

/* Admin → Opportunities.
 *
 * Three views in one tab: the list, the editor, and the applications for one
 * opportunity. Kept together because they are one job — an admin reviewing
 * applications frequently wants to reread what the opportunity promised.
 */
export default function OpportunitiesTab({ toast }) {
  const [rows, setRows] = useState([]);
  const [counts, setCounts] = useState({});
  const [status, setStatus] = useState('');
  const [editing, setEditing] = useState(null);
  const [viewingApps, setViewingApps] = useState(null);   // the opportunity
  const [hint, setHint] = useState('');
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    aGet('/api/admin/opportunities' + (status ? `?status=${status}` : '')).then(r => {
      setRows(r.ok ? (r.opportunities || []) : []);
      setCounts(r.counts || {});
      setHint(r.ok ? '' : (r.hint || r.message || ''));
      setLoading(false);
    });
  };
  useEffect(load, [status]);   // eslint-disable-line react-hooks/exhaustive-deps

  async function remove(o) {
    if (!confirm(`Delete “${o.title}”? This cannot be undone.`)) return;
    const r = await aDel('/api/admin/opportunities?id=' + o.id);
    if (!r.ok) return toast?.(r.message || 'Failed.', 'err');
    toast?.('Deleted.', 'ok'); load();
  }

  async function act(o, action, label) {
    if (!confirm(`${label} “${o.title}”?`)) return;
    const r = await aPost('/api/admin/opportunities', { ...o, cover_data: '', action });
    if (!r.ok) return toast?.(r.message || 'Failed.', 'err');
    toast?.(`${label}d.`, 'ok'); load();
  }

  if (viewingApps) return (
    <ApplicationsView opportunity={viewingApps} toast={toast}
      onBack={() => { setViewingApps(null); load(); }} />
  );

  if (editing) return (
    <OpportunityEditor value={editing} toast={toast}
      onCancel={() => setEditing(null)}
      onSaved={() => { setEditing(null); load(); }} />
  );

  const chip = (k, label) => (
    <button onClick={() => setStatus(k)}
      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${status === k
        ? 'bg-tnr-gold text-tnr-black' : 'text-tnr-cream/60 hover:bg-white/5 border border-tnr-line'}`}>
      {label}{k && counts[k] ? ` (${counts[k]})` : ''}
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-[240px]">
          <h2 className="text-xl font-bold text-tnr-cream">Opportunities</h2>
          <p className="text-sm text-tnr-cream/50 mt-1">
            The public board shows only the teaser. Full details and applications
            are visible to signed-in members.
          </p>
        </div>
        <button onClick={() => setEditing({ ...BLANK })}
          className="px-4 py-2 rounded-xl bg-tnr-gold text-tnr-black font-semibold text-sm">
          + New opportunity
        </button>
      </div>

      {hint && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs">
          {hint}
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {chip('', 'All')}{chip('published', 'Published')}{chip('draft', 'Drafts')}
        {chip('closed', 'Closed')}{chip('archived', 'Archived')}
      </div>

      {!rows.length && (
        <Card><div className="text-sm text-tnr-cream/40 text-center py-8">
          {loading ? 'Loading…' : 'No opportunities yet.'}
        </div></Card>
      )}

      {rows.map(o => (
        <Card key={o.id}>
          <div className="flex gap-4">
            {o.cover_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={o.cover_url} alt="" className="w-28 aspect-[16/9] object-cover rounded-lg shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-tnr-cream">{o.title}</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/10 text-tnr-cream/70">
                  {categoryLabel(o)}
                </span>
                <span className="text-[10px] font-bold text-tnr-cream/40 uppercase">{o.status}</span>
                {o.status === 'published' && (
                  <span className="text-[10px] font-bold text-tnr-goldLight">{STATUS_LABEL[o.state]}</span>
                )}
                {o.pinned && <span className="text-[10px] font-bold text-tnr-gold">PINNED</span>}
              </div>

              {o.organization && <p className="mt-0.5 text-xs text-tnr-cream/50">{o.organization}</p>}

              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                <button onClick={() => setEditing({ ...BLANK, ...o, cover_data: '' })}
                  className="text-tnr-goldLight hover:underline">Edit</button>

                {o.application_type === 'internal' && (
                  <button onClick={() => setViewingApps(o)} className="text-tnr-cream/70 hover:underline">
                    Applications ({o.stats?.total || 0})
                  </button>
                )}

                {o.status !== 'published'
                  ? <button onClick={() => act(o, 'publish', 'Publish')} className="text-tnr-cream/70 hover:underline">Publish</button>
                  : <button onClick={() => act(o, 'unpublish', 'Unpublish')} className="text-tnr-cream/70 hover:underline">Unpublish</button>}

                {o.status === 'published' && (
                  <button onClick={() => act(o, 'close', 'Close')} className="text-tnr-cream/70 hover:underline">Close</button>
                )}
                {o.status !== 'archived' && (
                  <button onClick={() => act(o, 'archive', 'Archive')} className="text-tnr-cream/70 hover:underline">Archive</button>
                )}

                <span className="text-tnr-cream/30">
                  {o.deadline ? `Deadline ${fmtDate(o.deadline)}` : 'No deadline'}
                </span>

                <button onClick={() => remove(o)} className="text-red-400 hover:underline ml-auto">Delete</button>
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

export { BLANK as BLANK_OPPORTUNITY, CATEGORIES, ADMIN_STATUSES };
