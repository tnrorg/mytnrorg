'use client';
export function Card({ children, className = '' }) { return <div className={`card p-5 ${className}`}>{children}</div>; }
export function Stat({ label, value, tone }) {
  const c = { green: 'text-tnr-greenLight', gold: 'text-tnr-gold', red: 'text-red-400', cream: 'text-tnr-cream' }[tone] || 'text-tnr-cream';
  return <div className="stat"><div className={`text-3xl font-black ${c}`}>{value ?? 0}</div>
    <div className="text-[11px] uppercase tracking-wider text-tnr-cream/50">{label}</div></div>;
}
export function Badge({ children, tone = 'gray' }) {
  const m = { Approved: 'bg-green-500/15 text-green-300', Pending: 'bg-yellow-500/15 text-yellow-300',
    Blocked: 'bg-red-500/15 text-red-300', Active: 'bg-green-500/15 text-green-300', Hidden: 'bg-white/10 text-tnr-cream/60',
    Voted: 'bg-tnr-gold/20 text-tnr-goldLight', gray: 'bg-white/10 text-tnr-cream/70',
    Draft: 'bg-white/10 text-tnr-cream/70', Paused: 'bg-orange-500/15 text-orange-300', Ended: 'bg-blue-500/15 text-blue-300' };
  return <span className={`chip ${m[children] || m.gray}`}>{children}</span>;
}
export function Field({ label, children }) { return <label className="block mb-3"><span className="label">{label}</span>{children}</label>; }
export function Toast({ msg, tone = 'ok', onDone }) {
  if (!msg) return null;
  return <div className={`fixed bottom-5 right-5 z-50 card px-4 py-3 animate-pop ${tone === 'err' ? 'border-red-500/50' : 'border-tnr-gold/50'}`}>
    <span className={tone === 'err' ? 'text-red-300' : 'text-tnr-goldLight'}>{msg}</span></div>;
}
