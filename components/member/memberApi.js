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
  let res;
  try {
    res = await fetch(url, {
      method, headers, cache: 'no-store',
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    // No response at all — there is nothing to parse, and returning {} here
    // would look identical to a server that replied with nothing to say.
    return { ok: false, error: 'NETWORK', message: 'Could not reach the server. Check your connection and try again.' };
  }

  if (res.status === 401 || res.status === 403) {
    clearToken();
    if (typeof window !== 'undefined' && !url.includes('/login')) window.location.href = '/member/login';
  }

  const data = await res.json().catch(() => null);

  /* A non-JSON body means the request never reached our code — the platform
   * rejected it first. This used to return `{}`, which has no `ok` and no
   * `message`, so every such failure surfaced as the caller's generic fallback
   * text. A member uploading a large image was told "Could not save." with no
   * hint that the file was the problem.
   *
   * 413 is the one worth naming: Vercel refuses request bodies over about
   * 4.5 MB before any of our code runs. */
  if (!data) {
    return {
      ok: false,
      error: `HTTP_${res.status}`,
      message: res.status === 413
        ? 'That upload is too large. Please use a smaller image (under about 3 MB).'
        : `The server returned ${res.status} ${res.statusText || ''}`.trim(),
    };
  }
  return data;
}
export const mGet   = (u) => req('GET', u);
export const mPost  = (u, b) => req('POST', u, b);
export const mPatch = (u, b) => req('PATCH', u, b);
export const mDel   = (u) => req('DELETE', u);
