'use client';
import { useEffect, useRef, useState } from 'react';

const KEY = 'tnr_application_draft_v1';
// Photos are large base64 strings; keeping them out of the draft avoids
// blowing the ~5MB localStorage budget and storing a face on a shared device.
const OMIT = ['photo_data'];

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
