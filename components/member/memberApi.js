'use client';
// Member portal API helper — mirrors the admin adminApi pattern.
export const getToken  = () => typeof window !== 'undefined' ? localStorage.getItem('tnr_member_token') : null;
export const setToken  = (t) => localStorage.setItem('tnr_member_token', t);
export const clearToken = () => localStorage.removeItem('tnr_member_token');

async function req(method, url, body) {
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' };
  const t = getToken(); if (t) headers.Authorization = `Bearer ${t}`;
  // no-store: the browser must never serve a cached copy of member data,
  // otherwise changes (e.g. a new profile photo) appear on some pages only.
  const res = await fetch(url, {
    method, headers, cache: 'no-store',
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 || res.status === 403) {
    clearToken();
    if (typeof window !== 'undefined' && !url.includes('/login')) window.location.href = '/member/login';
  }
  return data;
}
export const mGet   = (u) => req('GET', u);
export const mPost  = (u, b) => req('POST', u, b);
export const mPatch = (u, b) => req('PATCH', u, b);
