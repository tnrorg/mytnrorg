'use client';
import { useEffect, useState } from 'react';
import { Briefcase, Lock, X, LogIn, UserPlus } from 'lucide-react';
import SiteNav from '@/components/site/SiteNav';
import SiteFooter from '@/components/site/SiteFooter';
import OpportunityCard from '@/components/opportunities/OpportunityCard';
import { COLORS, FONT } from '@/lib/design/tokens';
import { CATEGORIES, CATEGORY_TONE } from '@/lib/opportunities';

/* Public opportunities board.
 *
 * Promotes; does not disclose. Everything on this page arrives from
 * /api/public/opportunities, which selects only the teaser columns — so there
 * is no protected text in the markup, in the page source, or in the network
 * response, whether or not a component chooses to render it.
 *
 * "View Details" opens the members-only gate rather than the detail, because
 * the detail is not here to be opened.
 */
export default function PublicOpportunities() {
  const [rows, setRows] = useState(null);
  const [cat, setCat] = useState('');
  const [gate, setGate] = useState(null);        // the opportunity they tried to open
  const [why, setWhy] = useState(null);          // server's explanation of an empty board
  const [signedIn, setSignedIn] = useState(null);  // null = still checking

  /* Is the visitor already a signed-in member?
   *
   * Asked of the SERVER, not inferred from the presence of a token. An expired
   * or revoked session would otherwise send someone straight to the portal to
   * be bounced back to a login screen — worse than the gate they were trying
   * to avoid. */
  useEffect(() => {
    let off = false;
    let token = null;
    try { token = localStorage.getItem('tnr_member_token'); } catch { /* storage blocked */ }
    if (!token) { setSignedIn(false); return; }

    fetch('/api/member/me', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
      .then(r => r.json())
      .then(j => { if (!off) setSignedIn(!!(j?.ok && j.member)); })
      .catch(() => { if (!off) setSignedIn(false); });
    return () => { off = true; };
  }, []);

  /* Signed-in members skip the gate entirely and land on the opportunity
   * itself. The gate exists to explain a restriction to people it applies to;
   * showing it to someone who already has access is just a door in their way. */
  const openDetails = (o) => {
    if (signedIn) window.location.href = `/member/opportunities?id=${encodeURIComponent(o.id)}`;
    else setGate(o);
  };

  /* Honour ?category= from the navigation menu.
   *
   * Read from window.location rather than useSearchParams: the latter forces a
   * Suspense boundary during static generation, and this page is a small
   * client component that does not otherwise need one. */
  useEffect(() => {
    try {
      const c = new URLSearchParams(window.location.search).get('category');
      if (c && CATEGORIES.includes(c)) setCat(c);
    } catch { /* no query string to read */ }
  }, []);

  useEffect(() => {
    let off = false;
    setRows(null);
    fetch(`/api/public/opportunities${cat ? `?category=${encodeURIComponent(cat)}` : ''}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(j => {
        if (off) return;
        setRows(j?.ok ? (j.opportunities || []) : []);
        setWhy(j?.why || null);
      })
      .catch(() => { if (!off) { setRows([]); setWhy({ stage: 'network' }); } });
    return () => { off = true; };
  }, [cat]);

  // Close the gate on Escape, like every other dialog on the site.
  useEffect(() => {
    if (!gate) return;
    const onKey = (e) => { if (e.key === 'Escape') setGate(null); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [gate]);

  return (
    <div className="light-page min-h-screen bg-white" style={{ color: COLORS.charcoal, ...FONT }}>
      <SiteNav />

      <header className="relative overflow-hidden" style={{ background: '#063D2B' }}>
        <div aria-hidden="true" className="absolute inset-0 opacity-[.07]"
          style={{
            backgroundImage: 'radial-gradient(circle at 20% 20%, #fff 1px, transparent 1px)',
            backgroundSize: '26px 26px',
          }} />
        <div className="relative max-w-tnr-wide mx-auto px-5 py-14 sm:py-20">
          <div className="text-[11px] font-bold uppercase tracking-[.28em] mb-3"
            style={{ color: COLORS.gold400 }}>Opportunities</div>
          <h1 className="text-3xl sm:text-5xl font-black text-white leading-tight">
            Scholarships, Fellowships &amp; Careers
          </h1>
          <p className="mt-4 text-white/80 text-base sm:text-lg max-w-2xl leading-relaxed">
            Opportunities gathered for the young people of Roundu. Full details and
            applications are open to registered TNR members.
          </p>
        </div>
      </header>

      <main id="main" className="max-w-tnr-wide mx-auto px-5 py-12 sm:py-16">
        <div className="flex flex-wrap gap-2 mb-10">
          <Chip on={!cat} onClick={() => setCat('')}>All</Chip>
          {CATEGORIES.map(c => (
            <Chip key={c} on={cat === c} onClick={() => setCat(c)} tone={CATEGORY_TONE[c]}>{c}</Chip>
          ))}
        </div>

        {rows === null && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[0, 1, 2].map(i => <div key={i} className="h-80 rounded-2xl bg-gray-50 animate-pulse" />)}
          </div>
        )}

        {rows !== null && !rows.length && (
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-12 text-center">
            <Briefcase size={30} className="mx-auto mb-3" style={{ color: COLORS.green700 }} aria-hidden="true" />
            <h2 className="font-black text-lg" style={{ color: COLORS.green900 }}>
              {cat ? `Nothing under ${cat} right now` : 'No opportunities open right now'}
            </h2>
            <p className="mt-2 text-sm text-gray-600 max-w-md mx-auto leading-relaxed">
              New scholarships, fellowships and programmes are posted here as they open.
              Members are notified in their portal.
            </p>

            {/* Only for a setup problem — a visitor to a genuinely empty board
                sees nothing extra. An admin who has published something and
                cannot find it gets the reason instead of a blank page. */}
            {why?.stage === 'migration_pending' && (
              <p className="mt-4 text-[12px] text-amber-700 max-w-md mx-auto leading-relaxed">
                Setup incomplete: the opportunities table is missing its newer columns.
                Run <code>migration_opportunities_v2.sql</code> in Supabase.
              </p>
            )}
            {why?.stage === 'query_failed' && (
              <p className="mt-4 text-[12px] text-amber-700 max-w-md mx-auto leading-relaxed">
                The opportunities table could not be read. {why.message}
              </p>
            )}
          </div>
        )}

        {rows !== null && rows.length > 0 && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {rows.map(o => <OpportunityCard key={o.id} o={o} onView={openDetails} />)}
          </div>
        )}
      </main>

      {/* ── Members-only gate ── */}
      {gate && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setGate(null)} role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-2xl bg-white p-7 text-center shadow-tnr-raise"
            onClick={e => e.stopPropagation()}>
            <button onClick={() => setGate(null)} aria-label="Close"
              className="float-right -mt-2 -mr-2 p-1.5 text-gray-400 hover:text-gray-600">
              <X size={18} />
            </button>

            <div className="mx-auto w-12 h-12 rounded-full grid place-items-center"
              style={{ background: 'rgba(23,107,73,.10)' }}>
              <Lock size={20} strokeWidth={2.2} style={{ color: COLORS.green700 }} aria-hidden="true" />
            </div>

            <h2 className="mt-4 text-xl font-black" style={{ color: COLORS.green900 }}>
              Members-Only Opportunity
            </h2>
            <p className="mt-2 text-[13.5px] text-gray-600 leading-relaxed">
              Complete opportunity details and application access are available
              exclusively to registered TNR members.
            </p>

            <p className="mt-4 rounded-xl bg-gray-50 px-4 py-3 text-[12.5px] font-semibold"
              style={{ color: COLORS.green900 }}>{gate.title}</p>

            <div className="mt-5 space-y-2.5">
              {/* Plain login link: the sign-in page has no return-URL support
                  and adding one would mean changing authentication, which is
                  outside this module. */}
              <a href="/member/login"
                className="flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-white"
                style={{ background: COLORS.green700 }}>
                <LogIn size={15} strokeWidth={2.4} aria-hidden="true" />
                Login to Member Portal
              </a>
              <a href="/membership/apply"
                className="flex items-center justify-center gap-2 rounded-xl border px-5 py-3 text-sm font-bold"
                style={{ borderColor: 'rgba(6,61,43,.18)', color: COLORS.green700 }}>
                <UserPlus size={15} strokeWidth={2.4} aria-hidden="true" />
                Become a TNR Member
              </a>
            </div>
          </div>
        </div>
      )}

      <SiteFooter />
    </div>
  );
}

function Chip({ on, onClick, tone, children }) {
  return (
    <button onClick={onClick}
      className={`rounded-full px-4 py-2 text-[13px] font-bold transition-colors duration-micro
        ${on ? 'text-white' : 'text-gray-600 bg-gray-100 hover:bg-gray-200'}`}
      style={on ? { background: tone?.fg || COLORS.green700 } : undefined}>
      {children}
    </button>
  );
}
