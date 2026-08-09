import jwt from 'jsonwebtoken';
import { jwtSecret } from './jwtSecret';

// Namespaced so a vote token can never be replayed as a session token.
const SECRET = () => jwtSecret() + '::vote';
export function signVoteToken(payload)  { return jwt.sign({ ...payload, t: 'vote' }, SECRET(), { expiresIn: '15m' }); }
export function verifyVoteToken(token)   { try { const p = jwt.verify(token, SECRET()); return p.t === 'vote' ? p : null; } catch { return null; } }
