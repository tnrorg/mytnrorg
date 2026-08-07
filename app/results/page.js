'use client';
import { useEffect, useState } from 'react';
import { useLang } from '@/components/useLang';
import { BrandHeader } from '@/components/Brand';
import Footer from '@/components/DarkFooter';

export default function Results() {
  const { lang, toggle, t } = useLang();
  const rtl = lang === 'ur';
  const [r, setR] = useState(null);
  useEffect(() => { fetch('/api/public/results?t=' + Date.now(), { cache: 'no-store' }).then(x => x.json()).then(setR).catch(() => {}); }, []);

  return (
    <main id="main" className="min-h-screen flex flex-col" dir={rtl ? 'rtl' : 'ltr'}>
      <BrandHeader lang={lang} onToggle={toggle} t={t} />
      <section className="flex-1 max-w-5xl mx-auto w-full px-4 py-8">
        <h1 className={`text-3xl font-black heading-gold mb-1 ${rtl ? 'urdu' : ''}`}>{t.results}</h1>
        {r?.election && <p className="text-tnr-cream/60 mb-6">{r.election.title}</p>}

        {!r && <p className="text-tnr-cream/50">Loading…</p>}
        {r && r.results_visible === false && (
          <div className="card p-8 text-center">
            <div className="text-5xl mb-3">🔒</div>
            <p className={`text-lg text-tnr-cream/80 ${rtl ? 'urdu' : ''}`}>{t.resultsHidden}</p>
            <a href="/dashboard" className="btn-gold mt-6 inline-flex">{t.liveDashboard}</a>
          </div>
        )}
        {r?.results_visible && <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            <KPI label={t.totalVoters} value={r.total_voters} />
            <KPI label={t.votesCast} value={r.total_votes} />
            <KPI label={t.participation} value={`${r.participation}%`} gold />
            <KPI label={t.results} value={r.election?.result_published ? 'Final' : 'Live'} />
          </div>
          {r.positions.map(p => (
            <div key={p.position_id} className="card p-5 mb-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-tnr-goldLight text-lg">{p.position}</h2>
                <span className="text-xs text-tnr-cream/50">{p.total} {rtl ? 'ووٹ' : 'votes'}</span>
              </div>
              <div className="space-y-3">
                {p.candidates.map(c => (
                  <div key={c.id}>
                    <div className="flex items-center gap-3 mb-1">
                      <img src={c.photo_url || '/tnr-logo.png'} className="w-9 h-9 rounded-lg object-cover border border-tnr-line" alt="" />
                      <span className="font-semibold text-tnr-cream flex-1">{c.name}</span>
                      {p.winner === c.id && <span className="chip bg-tnr-gold text-tnr-black">🏆 {t.winner}</span>}
                      <span className="text-tnr-goldLight font-bold tabular-nums">{c.votes} · {c.percent}%</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-black/40 overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-tnr-green2 to-tnr-gold rounded-full transition-all" style={{ width: `${c.percent}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {r.union_share?.length > 0 && (
            <div className="card p-5">
              <h2 className="font-bold text-tnr-goldLight text-lg mb-4">{rtl ? 'یونین کے حساب سے ووٹ' : 'Union-wise Vote Share'}</h2>
              {r.union_share.map(u => { const max = r.union_share[0].votes || 1; return (
                <div key={u.union} className="mb-2">
                  <div className="flex justify-between text-sm mb-1"><span className="text-tnr-cream/80">{u.union}</span><span className="text-tnr-goldLight">{u.votes}</span></div>
                  <div className="h-2 rounded-full bg-black/40 overflow-hidden"><div className="h-full bg-tnr-gold/80 rounded-full" style={{ width: `${(u.votes / max) * 100}%` }} /></div>
                </div>); })}
            </div>
          )}
        </>}
      </section>
      <Footer t={t} rtl={rtl} />
    </main>
  );
}
function KPI({ label, value, gold }) {
  return <div className="stat items-center text-center">
    <div className={`text-2xl font-black ${gold ? 'text-tnr-gold' : 'text-tnr-cream'}`}>{value}</div>
    <div className="text-[11px] uppercase tracking-wider text-tnr-cream/50">{label}</div>
  </div>;
}
