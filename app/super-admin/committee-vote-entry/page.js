'use client';
import { useEffect, useState } from 'react';
import dynamicImport from 'next/dynamic';
import { getToken, aGet } from '@/components/admin/adminApi';
import { Toast } from '@/components/admin/ui';
import { Logo } from '@/components/Brand';
const CommitteeVoteTab = dynamicImport(() => import('@/components/admin/CommitteeVoteTab'), { ssr: false });

export default function CommitteeVoteEntryPage() {
  const [state, setState] = useState('checking'); // checking | ok | denied | anon
  const [toastMsg, setToastMsg] = useState(''); const [toastTone, setToastTone] = useState('ok');
  const toast = (m, t = 'ok') => { setToastMsg(m); setToastTone(t); setTimeout(() => setToastMsg(''), 2600); };
  useEffect(() => {
    if (!getToken()) return setState('anon');
    // The server decides — the browser cannot grant itself this page.
    aGet('/api/admin/me')
      .then(r => setState(r?.ok && (r.extra_tabs || []).some(t => t[0] === 'committee') ? 'ok' : 'denied'))
      .catch(() => setState('denied'));
  }, []);

  if (state === 'checking') return <div className="min-h-screen grid place-items-center text-tnr-cream/50">…</div>;
  if (state === 'anon') return <Center><h1 className="text-2xl font-bold text-tnr-cream mb-2">Sign in required</h1>
    <a href="/admin" className="btn-gold">Go to Admin Login</a></Center>;
  if (state === 'denied') return <Center>
    <div className="text-6xl mb-3">⛔</div>
    <h1 className="text-3xl font-black text-red-400">403 Forbidden</h1>
    <p className="text-tnr-cream/70 mt-2">You do not have permission to access this resource.</p>
    <a href="/admin" className="btn-ghost mt-6">Back to Admin</a></Center>;

  return <div className="min-h-screen p-4 sm:p-8 max-w-3xl mx-auto">
    <div className="flex items-center gap-3 mb-6"><Logo size={44} />
      <div><h1 className="text-2xl font-black heading-gold">Committee Vote Entry</h1>
        <div className="text-xs text-tnr-gold uppercase tracking-widest">Super Admin</div></div>
      <a href="/admin" className="ml-auto text-sm text-tnr-cream/50 hover:text-tnr-gold">← Admin</a>
    </div>
    <CommitteeVoteTab toast={toast} />
    <Toast msg={toastMsg} tone={toastTone} />
  </div>;
}
function Center({ children }) { return <div className="min-h-screen grid place-items-center text-center px-4">
  <div className="card p-10 max-w-md">{children}</div></div>; }
