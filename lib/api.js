import { NextResponse } from 'next/server';

const NO_STORE = { 'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate' };

export const ok = (data = {}, init = {}) => {
  const res = NextResponse.json({ ok: true, ...data }, init);
  for (const [k, v] of Object.entries(NO_STORE)) res.headers.set(k, v);
  return res;
};
export const fail = (error, status = 400, extra = {}) => {
  const res = NextResponse.json({ ok: false, error, ...extra }, { status });
  for (const [k, v] of Object.entries(NO_STORE)) res.headers.set(k, v);
  return res;
};
export async function readJson(req) { try { return await req.json(); } catch { return {}; } }
