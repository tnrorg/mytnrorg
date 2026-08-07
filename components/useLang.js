'use client';
import { useState, useEffect } from 'react';
import { STR } from '@/lib/i18n';
export function useLang() {
  const [lang, setLang] = useState('en');
  useEffect(() => { const s = localStorage.getItem('tnr_lang'); if (s) setLang(s); }, []);
  const toggle = () => setLang(l => { const n = l === 'en' ? 'ur' : 'en'; localStorage.setItem('tnr_lang', n); return n; });
  return { lang, setLang, toggle, t: STR[lang] };
}
