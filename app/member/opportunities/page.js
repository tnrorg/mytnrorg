'use client';
import { useEffect, useState } from 'react';
import MemberShell from '@/components/member/MemberShell';
import { mGet, mPost } from '@/components/member/memberApi';
import OpportunityCard from '@/components/opportunities/OpportunityCard';
import OpportunityDetail from '@/components/opportunities/OpportunityDetail';
import {
  MEMBER_TABS, APP_STATUS_LABEL, APP_STATUS_TONE, fmtDate,
} from '@/lib/opportunities';

const C = { deep: '#063D2B', green: '#0B6B4F' };
const mont = { fontFamily: 'var(--font-mulish), Mulish, system-ui, sans-serif' };

/* Member portal — Opportunities.
 *
 * Two views in one page rather than two routes: the board, and one opportunity
 * open. A member who applies and closes the detail returns to the board with
 * the card already showing "Application Submitted", which a separate route
 * would have to refetch to discover.
 */
export default function Opportunities() {
  const [d, setD] = useState(null);
  const [tab, setTab] = useState('');
  const [openId, setOpenId] = useState(null);
  const [showApps, setShowApps] = useState(false);

  const load = () => mGet('/api/member/opportunities').then(r => r.ok && setD(r));
  useEffect(() => { load(); }, []);

  /* Deep link from the public board: /member/opportunities?id=…
   *
   * A signed-in member who clicks "View Details" out on the public site should
   * land on that opportunity, not on the board with the job of finding it
   * again. Read from window.location rather than useSearchParams, which would
   * force a Suspense boundary this page does not otherwise need. */
  useEffect(() => {
    try {
      const id = new URLSearchParams(window.location.search).get('id');
      if (id) setOpenId(id);
    } catch { /* no query string to read */ }
  }, []);

  const toggleSave = async (o) => {
    await mPost('/api/member/opportunities',
      { action: o.saved ? 'unsave' : 'save', opportunity_id: o.id });
    load();
  };

  const all = d?.opportunities || [];
  const match = MEMBER_TABS.find(t => t.key === tab)?.match;
  const rows = match ? all.filter(o => match.includes(o.category)) : all;
  const mine = all.filter(o => o.application);

  // ── One opportunity, open ──
  if (openId) return (
    <MemberShell active="/member/opportunities">
      <OpportunityDetail id={openId} onBack={() => {
        setOpenId(null);
        load();
        /* Drop ?id= from the address bar. Left there, a refresh would reopen
           the opportunity the member just closed, and Back would appear not to
           work. replaceState rather than push: closing a panel is not a place
           in the reader's history. */
        try { window.history.replaceState({}, '', '/member/opportunities'); } catch { /* ignore */ }
      }} />
    </MemberShell>
  );

  return (
    <MemberShell active="/member/opportunities">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 style={{ ...mont, color: C.deep }} className="text-2xl font-black">Opportunities</h1>
          <p className="mt-1 text-sm text-gray-500">
            Scholarships, fellowships and programmes open to TNR members.
          </p>
        </div>
        {mine.length > 0 && (
          <button onClick={() => setShowApps(v => !v)}
            className="rounded-xl border px-4 py-2 text-sm font-bold"
            style={{ borderColor: 'rgba(6,61,43,.18)', color: C.green }}>
            {showApps ? 'Browse Opportunities' : `My Applications (${mine.length})`}
          </button>
        )}
      </div>

      {/* ── My Applications ── */}
      {showApps ? (
        <div className="mt-6 space-y-3">
          {mine.map(o => {
            const a = o.application;
            const tone = APP_STATUS_TONE[a.status] || APP_STATUS_TONE.submitted;
            return (
              <div key={o.id}
                className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-black text-[16px]" style={{ color: C.deep }}>{o.title}</h3>
                    <p className="mt-1 text-[12.5px] text-gray-500">
                      Application Date: {fmtDate(a.submitted_at)}
                    </p>
                  </div>
                  <span className="rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wider"
                    style={{ background: tone.bg, color: tone.fg }}>
                    {APP_STATUS_LABEL[a.status] || a.status}
                  </span>
                </div>
                <button onClick={() => { setShowApps(false); setOpenId(o.id); }}
                  className="mt-3 text-[13px] font-bold hover:underline" style={{ color: C.green }}>
                  View opportunity →
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <>
          <div className="mt-5 flex flex-wrap gap-1.5">
            {MEMBER_TABS.map(t => (
              <button key={t.key || 'all'} onClick={() => setTab(t.key)}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold border transition ${tab === t.key
                  ? 'text-white border-transparent' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}
                style={tab === t.key ? { background: C.green } : {}}>
                {t.label}
              </button>
            ))}
          </div>

          {!d && (
            <div className="mt-6 grid sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {[0, 1, 2].map(i => <div key={i} className="h-80 rounded-2xl bg-gray-50 animate-pulse" />)}
            </div>
          )}

          {d && !rows.length && (
            <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-10 text-center">
              <div className="text-3xl">💼</div>
              <h3 style={{ ...mont, color: C.deep }} className="mt-2 font-extrabold">
                Nothing here right now
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                New opportunities appear here as the committee posts them.
              </p>
            </div>
          )}

          {d && rows.length > 0 && (
            <div className="mt-6 grid sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {rows.map(o => (
                <OpportunityCard key={o.id} o={o} onView={() => setOpenId(o.id)}
                  ctaLabel={o.application ? 'View Application' : 'View Details'}
                  footer={
                    <div className="mt-2 flex items-center justify-between gap-2">
                      {o.application ? (
                        <span className="rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider"
                          style={{
                            background: (APP_STATUS_TONE[o.application.status] || {}).bg,
                            color: (APP_STATUS_TONE[o.application.status] || {}).fg,
                          }}>
                          {APP_STATUS_LABEL[o.application.status]}
                        </span>
                      ) : <span />}
                      <button onClick={(e) => { e.stopPropagation(); toggleSave(o); }}
                        className="text-[11px] font-semibold text-gray-400 hover:text-gray-700">
                        {o.saved ? '★ Saved' : '☆ Save'}
                      </button>
                    </div>
                  } />
              ))}
            </div>
          )}
        </>
      )}
    </MemberShell>
  );
}
