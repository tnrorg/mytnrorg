'use client';
import { useEffect, useRef, useState } from 'react';

const KEY = 'tnr_application_draft_v1';
// Never written to localStorage.
//
//   photo_data       — large base64; would blow the ~5MB budget, and leaves a
//                      face behind on a shared or internet-café machine.
//   cnic_*_data      — identity documents. localStorage is readable by any
//                      script on the origin and survives until cleared; a
//                      national ID card must not sit there after the applicant
//                      walks away.
//   password         — never persist a plaintext password anywhere, least of
//                      all in storage that any XSS could read.
const OMIT = [
  'photo_data',
  'cnic_front_data', 'cnic_back_data',
  'password', 'password_confirm',
];

/** Auto-saves the in-progress application so a refresh or a dropped
 *  connection does not lose a long-form answer. Returns a save indicator. */
export function useApplicationDraft(form, setForm, blank) {
  const [status, setStatus] = useState('idle');   // idle | saved | restored
  const restored = useRef(false);

  // Restore once, on mount.
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      // Only merge keys the current form actually knows about, so an older
      // draft cannot inject stale or unexpected fields.
      const clean = Object.fromEntries(
        Object.entries(saved).filter(([k]) => k in blank && !OMIT.includes(k)));
      if (Object.keys(clean).length) {
        setForm(f => ({ ...f, ...clean }));
        setStatus('restored');
      }
    } catch { /* corrupted draft — ignore and start fresh */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced save on change.
  useEffect(() => {
    if (!restored.current) return;
    const t = setTimeout(() => {
      try {
        const body = Object.fromEntries(
          Object.entries(form).filter(([k]) => !OMIT.includes(k)));
        localStorage.setItem(KEY, JSON.stringify(body));
        setStatus('saved');
      } catch { /* storage full or blocked — saving is best-effort */ }
    }, 600);
    return () => clearTimeout(t);
  }, [form]);

  const clearDraft = () => { try { localStorage.removeItem(KEY); } catch {} };
  return { status, clearDraft };
}
