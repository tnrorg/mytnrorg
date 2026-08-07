'use client';
import { useEffect, useState } from 'react';
import MemberShell from '@/components/member/MemberShell';
import { mGet, mPost } from '@/components/member/memberApi';
import { CV_TEMPLATES } from '@/lib/membership/cv';

const C = { deep: '#063D2B', green: '#0B6B4F' };
const mont = { fontFamily: 'var(--font-mulish), Mulish, system-ui, sans-serif' };

export default function CvList() {
  const [cvs, setCvs] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = () => mGet('/api/member/cv').then(r => r.ok && setCvs(r.cvs || []));
  useEffect(() => { load(); }, []);

  async function create(template) {
    setBusy(true);
    const r = await mPost('/api/member/cv', { template, title: 'My CV' });
    setBusy(false);
    if (r.ok) window.location.href = '/member/cv-builder/' + r.cv.id;
  }

  return (
    <MemberShell active="/member/cv-builder">
      <h1 style={{ ...mont, color: C.deep }} className="text-2xl font-black">CV Builder</h1>
      <p className="mt-1 text-sm text-gray-500">
        Create multiple CVs from your profile. Editing a CV never changes your master profile.
      </p>

      {cvs === null && <p className="mt-6 text-gray-400 text-sm">Loading…</p>}

      {cvs?.length > 0 && (
        <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {cvs.map(cv => (
            <a key={cv.id} href={'/member/cv-builder/' + cv.id}
              className="rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-lg transition p-5">
              <div className="text-2xl">📄</div>
              <div style={{ ...mont, color: C.deep }} className="mt-2 font-extrabold">{cv.title}</div>
              <div className="text-xs text-gray-400 mt-0.5 capitalize">{cv.template} template</div>
              <div className="text-[11px] text-gray-400 mt-2">
                Updated {new Date(cv.updated_at).toLocaleDateString('en-GB', { dateStyle: 'medium' })}
              </div>
            </a>
          ))}
        </div>
      )}

      {cvs?.length === 0 && (
        <div className="mt-6 rounded-2xl bg-white border border-gray-100 shadow-sm p-8 text-center">
          <div className="text-4xl">📄</div>
          <h3 style={{ ...mont, color: C.deep }} className="mt-2 font-extrabold">No CVs yet</h3>
          <p className="mt-1 text-sm text-gray-500">Choose a template below — your profile details are filled in automatically.</p>
        </div>
      )}

      <h2 style={{ ...mont, color: C.deep }} className="mt-8 text-sm font-black uppercase tracking-wide">Create a New CV</h2>
      <div className="mt-3 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {CV_TEMPLATES.map(([key, name, desc]) => (
          <button key={key} disabled={busy} onClick={() => create(key)}
            className="text-left rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition p-5 disabled:opacity-50">
            <div style={{ ...mont, color: C.deep }} className="font-extrabold text-sm">{name}</div>
            <p className="mt-1 text-xs text-gray-500 leading-relaxed">{desc}</p>
            <span className="mt-3 inline-block text-xs font-bold" style={{ color: C.green }}>Use this template →</span>
          </button>
        ))}
      </div>
    </MemberShell>
  );
}
