#!/usr/bin/env node
/* Regenerates the seed block inside supabase/migration_university_portal.sql
 * from lib/edu/pakistanUniversities.js.
 *
 *   node scripts/gen-university-seed.mjs
 *
 * The list in JavaScript is the single source: the form's dropdown reads it,
 * and this script turns the same entries — and the same ambiguity-filtered
 * aliases — into SQL, so the database can never be seeded with a spelling the
 * form does not know about or vice versa.
 *
 * Only the text between the BEGIN/END GENERATED SEED markers is replaced.
 */
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const LIST = join(root, 'lib/edu/pakistanUniversities.js');
const SQL  = join(root, 'supabase/migration_university_portal.sql');

/* The project's package.json has no "type": "module", so Node would read the
   list as CommonJS and choke on `export`. Load a copy with an .mjs name. */
const tmp = join(mkdtempSync(join(tmpdir(), 'uniseed-')), 'list.mjs');
writeFileSync(tmp, readFileSync(LIST, 'utf8'));
const { PK_UNIVERSITIES, universityAliasPairs } = await import(pathToFileURL(tmp).href);

const q = (s) => (s == null ? 'null' : `'${String(s).replace(/'/g, "''")}'`);

const uniRows = PK_UNIVERSITIES.map(u => `  (${q(u.id)}, ${q(u.name)}, ${q(u.province)})`);
const aliasRows = universityAliasPairs().map(([a, id]) => `  (${q(a)}, ${q(id)})`);

const block = [
  '-- BEGIN GENERATED SEED',
  `-- ${uniRows.length} universities, ${aliasRows.length} aliases.`,
  'insert into tnr_universities (id, name, province) values',
  uniRows.join(',\n'),
  'on conflict (id) do nothing;',
  '',
  'insert into tnr_university_aliases (alias_norm, university_id) values',
  aliasRows.join(',\n'),
  'on conflict (alias_norm) do nothing;',
  '-- END GENERATED SEED',
].join('\n');

const sql = readFileSync(SQL, 'utf8');
const re = /-- BEGIN GENERATED SEED[\s\S]*?-- END GENERATED SEED/;
if (!re.test(sql)) throw new Error('Seed markers not found in ' + SQL);
writeFileSync(SQL, sql.replace(re, block));
console.log(`seed written: ${uniRows.length} universities, ${aliasRows.length} aliases`);
