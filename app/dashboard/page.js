'use client';
import { useEffect, useState } from 'react';
import { useLang } from '@/components/useLang';
import { BrandHeader } from '@/components/Brand';
import Footer from '@/components/DarkFooter';
import VictorySign from '@/components/VictorySign';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, CartesianGrid } from 'recharts';

const GOLD = '#E4C25B', GREEN = '#12603F', LIGHT = '#4FA37C';

export default function Dashboard() {
  const { lang, toggle, t } = useLang();
  const rtl = lang === 'ur';
  const [s, setS] = useState(null);
  const [ov, setOv] = useState(null);   // full election overview: positions + candidates + votes
  const load = () => {
    fetch('/api/public/stats?t=' + Date.now(), { cache: 'no-store' }).then(r => r.json()).then(setS).catch(() => {});
    fetch('/api/public/overview?t=' + Date.now(), { cache: 'no-store' }).then(r => r.json()).then(setOv).catch(() => {});
  };
  useEffect(() => { load(); const id = setInterval(load, 15000); return () => clearInterval(id); }, []);
  const pct = s?.participation || 0;

  return (
    <main id="main" className="min-h-screen flex flex-col" dir={rtl ? 'rtl' : 'ltr'}>
      <BrandHeader lang={lang} onToggle={toggle} t={t} />
      <section className="flex-1 max-w-5xl mx-auto w-full px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div><h1 className={`text-3xl font-black heading-gold ${rtl ? 'urdu' : ''}`}>{t.liveDashboard}</h1>
            {s?.election && <p className="text-tnr-cream/60">{s.election.title}</p>}</div>
          <span className="chip bg-tnr-green2/50 text-tnr-goldLight border border-tnr-line"><span className="w-2 h-2 rounded-full bg-tnr-gold animate-pulse" />Live</span>
        </div>
        {!s?.election && <p className="text-tnr-cream/50">No active election.</p>}
        {s?.election && <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            <KPI label={t.totalVoters} value={s.total_voters} />
            <KPI label={t.votesCast} value={s.votes_cast} gold />
            <KPI label={t.remaining} value={s.remaining} />
            <KPI label={t.participation} value={`${s.participation}%`} gold />
          </div>
          <div className="card p-8 flex flex-col items-center">
            <Ring pct={pct} />
            <p className={`mt-4 text-tnr-cream/70 text-center ${rtl ? 'urdu' : ''}`}>
              {s.votes_cast} / {s.total_voters} {rtl ? 'اراکین نے ووٹ ڈالا' : 'members have voted'}</p>
            {s.fairness_note && <div className={`mt-5 chip bg-tnr-gold/15 text-tnr-goldLight border border-tnr-line text-center ${rtl ? 'urdu' : ''}`}>🔒 {t.resultsHidden}</div>}
            {s.results_visible && <a href="/results" className="btn-gold mt-5">{t.results}</a>}
          </div>
        </>}

        <CandidateResults ov={ov} />
        <ResultCharts ov={ov} />
        <ElectedCards ov={ov} />
      </section>
      <Footer t={t} rtl={rtl} />
    </main>
  );
}

/* ─────────── Candidate results, per position ─────────── */
function CandidateResults({ ov }) {
  const positions = ov?.positions || [];
  if (!positions.length) return null;
  return (
    <div className="mt-10">
      <h2 className="text-2xl font-black heading-gold mb-4">Candidate Results</h2>
      <div className="space-y-6">
        {positions.map(p => {
          const total = (p.candidates || []).reduce((a, c) => a + (c.votes || 0), 0);
          return (
            <div key={p.id} className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <span className="chip bg-tnr-green2/50 text-tnr-goldLight border border-tnr-line">{p.title}</span>
                <span className="text-xs text-tnr-cream/40">{total} vote(s)</span>
              </div>
              <div className="space-y-3">
                {(p.candidates || []).map(c => {
                  const pct = total ? Math.round(((c.votes || 0) / total) * 1000) / 10 : 0;
                  return (
                    <div key={c.id} className="flex items-center gap-3">
                      <img src={c.photo_url || '/tnr-logo.png'} alt="" className="w-11 h-11 rounded-xl object-cover border border-tnr-line shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-tnr-cream truncate">{c.name}</span>
                          {c.status_badge && <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-tnr-gold text-tnr-black">{c.status_badge}</span>}
                          <span className="ml-auto text-sm text-tnr-cream/70 whitespace-nowrap">
                            {c.votes != null ? <b className="text-tnr-goldLight">{c.votes}</b> : '—'} {c.votes != null && <span className="text-tnr-cream/40">· {pct}%</span>}
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-black/40 overflow-hidden mt-1.5">
                          <div className="h-full rounded-full transition-all duration-700"
                            style={{ width: pct + '%', background: `linear-gradient(90deg,${GREEN},${GOLD})` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
                {!(p.candidates || []).length && <p className="text-sm text-tnr-cream/40">No candidates.</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─────────── Bar + pie charts ─────────── */
function ResultCharts({ ov }) {
  const positions = ov?.positions || [];
  const [tab, setTab] = useState(0);
  const p = positions[tab];
  if (!positions.length || !p) return null;
  const data = (p.candidates || []).map(c => ({ name: c.name, votes: c.votes || 0 }));
  const total = data.reduce((a, d) => a + d.votes, 0);
  const colors = [GREEN, GOLD, LIGHT, '#9CA3AF'];

  return (
    <div className="mt-10">
      <h2 className="text-2xl font-black heading-gold mb-4">Result Charts</h2>
      <div className="flex flex-wrap gap-2 mb-4">
        {positions.map((x, i) => (
          <button key={x.id} onClick={() => setTab(i)}
            className={`px-3 py-1.5 rounded-lg text-xs border transition ${i === tab
              ? 'bg-tnr-gold text-tnr-black border-tnr-gold font-bold'
              : 'border-tnr-line text-tnr-cream/60 hover:bg-white/5'}`}>{x.title}</button>
        ))}
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="card p-4">
          <div className="text-xs uppercase tracking-wider text-tnr-cream/50 mb-3">Votes per candidate</div>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="name" tick={{ fill: 'rgba(247,245,238,0.6)', fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fill: 'rgba(247,245,238,0.5)', fontSize: 11 }} />
                <Tooltip contentStyle={{ background: '#0E1A14', border: '1px solid rgba(212,167,44,0.3)', borderRadius: 12, color: '#F7F5EE' }} />
                <Bar dataKey="votes" radius={[8, 8, 0, 0]}>
                  {data.map((d, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card p-4">
          <div className="text-xs uppercase tracking-wider text-tnr-cream/50 mb-3">Vote share</div>
          <div className="h-60">
            {total ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data} dataKey="votes" nameKey="name" innerRadius="52%" outerRadius="82%" paddingAngle={3} strokeWidth={0}>
                    {data.map((d, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#0E1A14', border: '1px solid rgba(212,167,44,0.3)', borderRadius: 12, color: '#F7F5EE' }} />
                  <Legend wrapperStyle={{ color: 'rgba(247,245,238,0.7)', fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : <div className="h-full grid place-items-center text-tnr-cream/40 text-sm">No votes yet.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────── Elected candidates, one card each ─────────── */
function ElectedCards({ ov }) {
  const positions = ov?.positions || [];
  const winners = [];
  for (const p of positions) for (const c of (p.candidates || [])) if (c.elected) winners.push({ ...c, position: p.title });
  if (!winners.length) return null;
  return (
    <div className="mt-10">
      <h2 className="text-2xl font-black heading-gold mb-1">Elected Candidates</h2>
      <p className="text-sm text-tnr-cream/50 mb-4">Officially elected after the close of voting.</p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {winners.map(w => (
          <div key={w.id} className="card p-5 text-center border-tnr-gold/40">
            <div className="w-24 h-24 mx-auto rounded-full overflow-hidden ring-2 ring-tnr-gold">
              <img src={w.photo_url || '/tnr-logo.png'} alt={w.name} className="w-full h-full object-cover" />
            </div>
            <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-tnr-gold text-tnr-black">
              <VictorySign size={14} /> ELECTED
            </div>
            <h3 className="mt-2 font-extrabold text-tnr-cream">{w.name}</h3>
            <div className="text-xs text-tnr-goldLight">{w.position}</div>
            {w.votes != null && <div className="mt-2 text-sm text-tnr-cream/60">{w.votes} vote(s)</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

function KPI({ label, value, gold }) {
  return <div className="stat items-center text-center">
    <div className={`text-3xl font-black ${gold ? 'text-tnr-gold' : 'text-tnr-cream'}`}>{value}</div>
    <div className="text-[11px] uppercase tracking-wider text-tnr-cream/50">{label}</div></div>;
}
function Ring({ pct }) {
  const R = 84, C = 2 * Math.PI * R, off = C - (pct / 100) * C;
  return <svg width="220" height="220" viewBox="0 0 220 220" className="animate-fade-up">
    <circle cx="110" cy="110" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="16" />
    <circle cx="110" cy="110" r={R} fill="none" stroke="url(#gr)" strokeWidth="16" strokeLinecap="round"
      strokeDasharray={C} strokeDashoffset={off} transform="rotate(-90 110 110)" style={{ transition: 'stroke-dashoffset 1s ease' }} />
    <defs><linearGradient id="gr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#12603F" /><stop offset="1" stopColor="#E4C25B" /></linearGradient></defs>
    <text x="110" y="104" textAnchor="middle" fontSize="40" fontWeight="800" fill="#E4C25B">{pct}%</text>
    <text x="110" y="132" textAnchor="middle" fontSize="13" fill="rgba(247,245,238,0.6)">participation</text>
  </svg>;
}
