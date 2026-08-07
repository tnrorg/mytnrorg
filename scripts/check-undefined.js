#!/usr/bin/env node
/* Catches module-level data constants that are USED but never declared.
 *
 * Why this exists: a Vercel build failed with "ReferenceError: NEWS is not
 * defined" after a data array was deleted while a component still called
 * NEWS.map(...). esbuild does not flag that, there is no ESLint in this
 * project, and a full `next build` is slow.
 *
 * Scope is deliberately narrow rather than broad-and-noisy: it only looks at
 * SCREAMING_CASE identifiers that are used as a *value* — followed by .map(,
 * .filter(, .length, .slice(, [i], etc. Prose inside JSX ("TNR", "PDF") is
 * never followed by those, so it cannot produce a false positive. An earlier
 * attempt tried to strip JSX text with regexes and reported 20 phantom
 * problems; this reports only real ones.
 *
 * Usage:  node scripts/check-undefined.js            (app/ + components/ + lib/)
 *         node scripts/check-undefined.js path/a.js  (specific files)
 *
 * It checks two things:
 *   1. SCREAMING_CASE data constants used as a value.
 *   2. Capitalised JSX tags — <LanguagesIcon />. React requires these to be a
 *      value in scope (lowercase tags are HTML), so a capitalised tag that is
 *      never imported or declared is always a bug. This was added after an
 *      edit put <LanguagesIcon> into the council profile markup without the
 *      matching import: the build passed and the page threw
 *      "LanguagesIcon is not defined" in the browser.
 *
 * LIMITATION — read before trusting this.
 * It does NOT check camelCase helpers. A missing `areaColor` import crashed
 * the members page and this script did not catch it; extending it to
 * camelCase produced 116 false positives, because without stripping string
 * literals and doing real scope analysis it cannot tell a helper call from a
 * word inside a message. `next build` remains the only complete check.
 */
const fs = require('fs');
const path = require('path');

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== 'node_modules' && e.name !== '.next') walk(p, out);
    } else if (e.name.endsWith('.js') || e.name.endsWith('.jsx')) out.push(p);
  }
  return out;
}

const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

/** Names brought into scope by a declaration or an import. */
function declaredIn(src) {
  const d = new Set();

  for (const m of src.matchAll(/\bimport\s+(?:([A-Za-z_$][\w$]*)\s*,?\s*)?(?:\{([^}]*)\})?/g)) {
    if (m[1]) d.add(m[1]);
    (m[2] || '').split(',').forEach((x) => {
      const n = x.trim().split(/\s+as\s+/).pop().trim();
      if (n) d.add(n);
    });
  }
  // Any binding, not just SCREAMING_CASE: local components are declared as
  // `const Mini = ...` and the JSX rule below needs to see them.
  // Multi-declarator too: `const G = '#0B5836', DEEP = '#063D2B'`.
  for (const m of src.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/g)) d.add(m[1]);
  for (const m of src.matchAll(/,\s*([A-Za-z_$][\w$]*)\s*=/g)) d.add(m[1]);
  for (const m of src.matchAll(/\bfunction\s+([A-Za-z_$][\w$]*)/g)) d.add(m[1]);

  // Every `{ ... }` group: destructured assignments (`const { NAV } = ...`) and
  // destructured parameters (`function Arrow({ icon: Icon })`), which is how
  // components receive a renamed element prop.
  //
  // This is deliberately generous — it also sweeps up object literals. Being
  // generous costs a missed warning; being strict costs a false alarm, and a
  // checker that cries wolf gets ignored, which is worse than one that
  // occasionally stays quiet.
  for (const m of src.matchAll(/\{([^{}]*)\}/g)) {
    m[1].split(',').forEach((x) => {
      const n = x.trim().split(':').pop().replace(/=.*/, '').replace(/\.\.\./, '').trim();
      if (/^[A-Za-z_$][\w$]*$/.test(n)) d.add(n);
    });
  }
  // Array-destructured parameters: `.map(([title, desc, Icon]) => …)`.
  //
  // Restricted to a parameter position on purpose. Sweeping every `[...]`
  // would also swallow array literals like `[GraduationCap, Users]`, and a
  // missing import used only inside such a literal would then go unreported.
  for (const m of src.matchAll(/\(\s*\[([^\]]*)\]\s*(?:[,)]|=>)/g)) {
    m[1].split(',').forEach((x) => {
      const n = x.trim().replace(/=.*/, '').replace(/\.\.\./, '').trim();
      if (/^[A-Za-z_$][\w$]*$/.test(n)) d.add(n);
    });
  }
  return d;
}

/* A constant used as a value: NEWS.map( / NEWS.length / NEWS[0] / ...NEWS
   Requires the usage form, which prose in markup never takes. */
const USED_AS_VALUE = /\b([A-Z][A-Z0-9_]{2,})(?:\s*\.\s*(?:map|filter|forEach|slice|find|some|every|reduce|join|includes|indexOf|length|keys|entries)\b|\s*\[|\.\.\.)/g;

/* A JSX element whose tag starts with a capital: <LanguagesIcon ... />
 *
 * This is reliable in a way the SCREAMING_CASE rule is not. React requires a
 * capitalised JSX tag to be a value in scope — lowercase tags are HTML — so a
 * capitalised tag that is never imported or declared is always a bug. It is
 * exactly the failure that took the council profile page down: an edit adding
 * <LanguagesIcon> to the markup did not apply the matching import, the build
 * succeeded, and the page threw "LanguagesIcon is not defined" at runtime.
 *
 * Dotted tags (<Foo.Bar />) are matched on the root name only, which is the
 * part that has to be in scope. */
const JSX_TAG = /<([A-Z][A-Za-z0-9_]*)(?:\.[A-Za-z0-9_]+)*[\s/>]/g;

const files = process.argv.length > 2
  ? process.argv.slice(2)
  : [...walk('app'), ...walk('components'), ...walk('lib')];

let failures = 0;
for (const f of files) {
  const src = stripComments(fs.readFileSync(f, 'utf8'));
  const declared = declaredIn(src);
  const used = new Set([
    ...[...src.matchAll(USED_AS_VALUE)].map((m) => m[1]),
    ...[...src.matchAll(JSX_TAG)].map((m) => m[1]),
  ]);
  const missing = [...used].filter((u) => !declared.has(u));
  if (missing.length) {
    failures++;
    console.error(`  ✗ ${f}: ${missing.join(', ')} used but not defined`);
  }
}
if (failures) {
  console.error(`\n${failures} file(s) reference undefined data constants.`);
  process.exit(1);
}
console.log(`  ✓ ${files.length} files checked — no undefined data constants`);
