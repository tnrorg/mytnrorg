'use client';
export function Logo({ size = 44, badge = true }) {
  const img = <img src="/tnr-logo.png" width={size} height={size} alt="TNR" className="object-contain w-full h-full" />;
  if (!badge) return <span style={{ width: size, height: size }} className="inline-block">{img}</span>;
  const pad = Math.max(3, Math.round(size * 0.08));
  return (
    <span
      style={{ width: size, height: size, padding: pad }}
      className="inline-grid place-items-center rounded-full bg-white ring-2 ring-tnr-gold/70 shadow-[0_4px_18px_rgba(201,162,39,0.35)] overflow-hidden shrink-0"
    >
      {img}
    </span>
  );
}
export function BrandHeader({ lang, onToggle, t }) {
  return (
    <header className="w-full sticky top-0 z-30 border-b border-[#D4A72C]/30" style={{ background: '#063D2B' }}>
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <a href="/" className="flex items-center gap-3">
          <Logo size={40} />
          <div className="leading-tight">
            <div className="font-bold text-tnr-cream text-sm sm:text-base uppercase">{t.org}</div>
            <div className="text-[10px] sm:text-xs text-tnr-gold tracking-widest uppercase">{t.short} • Election {process.env.NEXT_PUBLIC_ELECTION_YEAR || '2026'}</div>
          </div>
        </a>
        <div className="flex items-center gap-2">
          <a href="/results" className="btn-ghost !py-2 !px-3 text-xs sm:text-sm">{t.results}</a>
          <a href="/dashboard" className="btn-ghost !py-2 !px-3 text-xs sm:text-sm hidden sm:inline-flex">{t.liveDashboard}</a>
          <button onClick={onToggle} className="btn-gold !py-2 !px-3 text-xs sm:text-sm uppercase tracking-wide">{t.language}</button>
        </div>
      </div>
    </header>
  );
}
