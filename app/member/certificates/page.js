'use client';
import { useEffect, useState } from 'react';
import MemberShell from '@/components/member/MemberShell';
import QrCode from '@/components/member/QrCode';
import { printSheet } from '@/components/member/printSheet';
import { mGet } from '@/components/member/memberApi';
import { CERT_DEFAULTS, fillCertificate } from '@/lib/certificateDefaults';

const G = '#063D2B', GR = '#0B6B4F', GOLD = '#D4A72C';
const mont = { fontFamily: 'var(--font-mulish), Mulish, system-ui, sans-serif' };

export default function CertificatePage() {
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    mGet('/api/member/certificate')
      .then(r => { if (r?.ok) setD(r); else setErr(r?.detail || r?.message || 'Could not load.'); })
      .catch(e => setErr(e.message || 'Request failed.'));
  }, []);
  if (err) return (
    <MemberShell active="/member/certificates">
      <div className="rounded-2xl bg-red-50 border border-red-200 p-5 text-sm">
        <div className="font-bold text-red-800">Could not load this page</div>
        <div className="mt-1 text-red-700 text-xs break-words">{err}</div>
        <div className="mt-2 text-red-700/80 text-xs">
          If this mentions a missing table or relation, run the membership migration files in
          Supabase (phase1 → phase6), in order.
        </div>
      </div>
    </MemberShell>
  );
  if (!d) return <MemberShell active="/member/certificates"><p className="text-gray-400">Loading…</p></MemberShell>;

  const { certificate: c, member: m } = d;
  // Admin-editable template (Admin → Certificate Template). Falls back to the
  // built-in defaults when the migration has not been run.
  const s = { ...CERT_DEFAULTS, ...(d.settings || {}) };
  const GOLD_A = s.accent_gold || GOLD;
  const GREEN_A = s.accent_green || G;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const verifyUrl = `${origin}/membership/verify?id=${c.certificate_no}`;
  const fmt = (x) => x ? new Date(x).toLocaleDateString('en-GB', { dateStyle: 'long' }) : '—';

  return (
    <MemberShell active="/member/certificates">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 style={{ ...mont, color: G }} className="text-2xl font-black">Membership Certificate</h1>
          <p className="mt-1 text-sm text-gray-500">Certificate No. <span className="font-mono">{c.certificate_no}</span></p>
        </div>
        <button onClick={() => printSheet('cert-sheet', c.certificate_no)}
          className="px-5 py-2.5 rounded-xl text-sm font-bold text-white"
          style={{ background: `linear-gradient(180deg,${GR},${G})` }}>Download / Print</button>
      </div>

      <div className="mt-6 overflow-auto">
        <div className="origin-top-left scale-[0.55] sm:scale-75 lg:scale-100">
          {/* A4 landscape certificate */}
          <div id="cert-sheet" className="bg-white shadow-xl relative"
            style={{ width: '297mm', height: '210mm', padding: '18mm', ...mont, color: '#111' }}>
            {s.show_border !== false && <>
              <div className="absolute inset-[8mm] pointer-events-none" style={{ border: `2px solid ${GOLD_A}` }} />
              <div className="absolute inset-[10mm] pointer-events-none" style={{ border: `1px solid ${GR}44` }} />
            </>}

            <div className="relative h-full flex flex-col items-center text-center">
              <img src={s.logo_url || '/tnr-logo.png'} alt="" className="w-[22mm] h-[22mm] object-contain"
                onError={(e) => { e.currentTarget.src = '/tnr-logo.png'; }} />
              <div className="text-[10pt] font-black tracking-[0.2em] mt-2" style={{ color: GREEN_A }}>
                {s.org_line1}
              </div>
              <div className="text-[8pt] tracking-widest text-gray-400">{s.org_line2}</div>

              <h1 className="text-[30pt] font-black mt-6" style={{ color: GREEN_A }}>{s.cert_title}</h1>
              <div className="w-[60mm] h-[2px] mt-2" style={{ background: GOLD_A }} />

              <p className="text-[11pt] text-gray-500 mt-6">{s.intro_line}</p>
              <h2 className="text-[24pt] font-black mt-1" style={{ color: GR }}>{m.full_name}</h2>
              {/* Body comes from the admin template with {{tokens}} substituted.
                  Rendered as plain text, not HTML — an admin editing a template
                  should never be able to inject markup into every member's
                  certificate. */}
              <p className="text-[11pt] text-gray-600 mt-3 max-w-[180mm] leading-relaxed">
                {fillCertificate(s.body_text, m)}
              </p>

              <div className="mt-auto w-full flex items-end justify-between">
                <div className="text-left">
                  {s.show_qr !== false && <>
                    <QrCode value={verifyUrl} size={80} />
                    <div className="text-[7pt] text-gray-400 mt-1">{s.scan_label}</div>
                  </>}
                  <div className="text-[7pt] font-mono text-gray-500">{c.certificate_no}</div>
                </div>
                <div className="text-center text-[9pt] text-gray-500">
                  <div>{s.issued_label}</div>
                  <div className="font-bold" style={{ color: GREEN_A }}>{fmt(c.issued_at)}</div>
                </div>
                <div className="text-center">
                  <img src={s.signature_url || '/signature.png'} alt=""
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    style={{ height: '14mm', width: 'auto', maxWidth: '46mm', objectFit: 'contain',
                      display: 'block', margin: '0 auto 1mm', mixBlendMode: 'multiply', filter: 'contrast(1.25)' }} />
                  <div className="w-[50mm] border-b" style={{ borderColor: GOLD_A }} />
                  <div className="text-[8pt] mt-1 font-semibold" style={{ color: GREEN_A }}>{s.signatory_title}</div>
                  <div className="text-[7.5pt] text-gray-500">{s.signatory_org}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MemberShell>
  );
}
