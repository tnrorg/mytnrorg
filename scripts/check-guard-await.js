#!/usr/bin/env node
/* Every call to the admin guard must be awaited.
 *
 * WHY THIS SCRIPT EXISTS, AND WHY IT MUST NOT BE DELETED
 *
 * requireAdmin and requireSuperAdmin are async, because they check the session
 * epoch against the database so a signed-out session really is signed out.
 *
 * The failure mode of forgetting `await` is the worst kind: silent, and open.
 *
 *     const { admin, res } = requireAdmin(req);   // ← a Promise
 *     if (res) return res;                        // ← res is undefined
 *     ...                                         // ← route runs UNAUTHENTICATED
 *
 * No error is thrown. Nothing is logged. The route simply serves every request
 * to anyone who asks. One missing keyword removes authentication from an admin
 * endpoint entirely, and nothing about the code looks wrong.
 *
 * So it is checked mechanically, on every run, rather than trusted to review.
 *
 *     node scripts/check-guard-await.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const GUARDS = /\b(requireAdmin|requireSuperAdmin)\s*\(/g;

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (/\.(js|jsx|ts|tsx)$/.test(entry.name)) out.push(p);
  }
  return out;
}

const problems = [];
let checked = 0;
let calls = 0;

for (const file of walk(path.join(ROOT, 'app'))) {
  const src = fs.readFileSync(file, 'utf8');
  if (!/require(Super)?Admin/.test(src)) continue;
  checked += 1;

  const lines = src.split('\n');
  lines.forEach((line, i) => {
    // Skip comments — the guards are discussed in prose in several files.
    const code = line.replace(/\/\/.*$/, '').replace(/^\s*\*.*$/, '');
    let m;
    GUARDS.lastIndex = 0;
    while ((m = GUARDS.exec(code))) {
      // A definition, not a call.
      if (/function\s+$/.test(code.slice(0, m.index))) continue;
      calls += 1;
      const before = code.slice(0, m.index);
      if (!/await\s+$/.test(before)) {
        problems.push(`${path.relative(ROOT, file)}:${i + 1}  ${line.trim()}`);
      }
    }
  });
}

if (problems.length) {
  console.error(`\n  ✗ ${problems.length} unawaited call(s) to the admin guard.\n`);
  console.error('    These routes would run with NO authentication:\n');
  for (const p of problems) console.error(`      ${p}`);
  console.error('\n    Add `await`. See lib/guard.js.\n');
  process.exit(1);
}

console.log(`  ✓ ${calls} guard call(s) across ${checked} files — every one awaited`);
