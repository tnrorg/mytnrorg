'use client';
export function getToken() { return typeof window !== 'undefined' ? localStorage.getItem('tnr_admin_token') : null; }
export function setToken(t) { localStorage.setItem('tnr_admin_token', t); }
export function clearToken() { localStorage.removeItem('tnr_admin_token'); }

async function req(method, url, body) {
  const headers = { 'Content-Type': 'application/json' };
  const tok = getToken(); if (tok) headers.Authorization = `Bearer ${tok}`;
  let res;
  try {
    res = await fetch(url, { method, headers, cache: 'no-store', body: body ? JSON.stringify(body) : undefined });
  } catch {
    // Network-level failure: no response at all, so there is nothing to parse.
    return { ok: false, error: 'NETWORK', message: 'Could not reach the server. Check your connection and try again.' };
  }

  if (res.status === 401) { clearToken(); if (typeof window !== 'undefined') window.dispatchEvent(new Event('tnr-logout')); }

  const data = await res.json().catch(() => null);
  // A non-JSON body means the request never reached our code — a platform-level
  // rejection. Returning a bare {} here used to surface as "Save failed" with
  // no clue why; 413 in particular (payload too large) is worth naming.
  if (!data) {
    return {
      ok: false,
      error: `HTTP_${res.status}`,
      message: res.status === 413
        ? 'That upload is too large for the server. Use a smaller image.'
        : `The server returned ${res.status} ${res.statusText || ''}`.trim(),
    };
  }
  return data;
}
export const aGet   = (u) => req('GET', u);
export const aPost  = (u, b) => req('POST', u, b);
export const aPatch = (u, b) => req('PATCH', u, b);
export const aDel   = (u) => req('DELETE', u);

// Roles are deliberately NOT derived on the client.
// Ask the server (/api/admin/me) — it verifies the signature and re-reads the database.
