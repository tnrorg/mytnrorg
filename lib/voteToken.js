import jwt from 'jsonwebtoken';
const SECRET = (process.env.JWT_SECRET || 'tnr_secret') + '::vote';
export function signVoteToken(payload)  { return jwt.sign({ ...payload, t: 'vote' }, SECRET, { expiresIn: '15m' }); }
export function verifyVoteToken(token)   { try { const p = jwt.verify(token, SECRET); return p.t === 'vote' ? p : null; } catch { return null; } }
