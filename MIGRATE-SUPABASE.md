# Migrating TNR data: OLD Supabase project → NEW Supabase project

**Situation:** the new project has the schema + `seed.sql` sample rows, but none of the
real data. Everything below moves the real data (including votes and receipts) across.

> ⚠️ Do this once, in one sitting. Stop writing to the old project before you start,
> otherwise rows created mid-migration are lost.

---

## 0. Collect what you need

From **each** Supabase dashboard → **Project Settings → Database → Connection string → URI**
(tick "Display connection pooler" **off** — you want the **direct** connection on port 5432):

```
OLD:  postgresql://postgres.<OLD_REF>:<OLD_DB_PASSWORD>@aws-0-<region>.pooler.supabase.com:5432/postgres
NEW:  postgresql://postgres.<NEW_REF>:<NEW_DB_PASSWORD>@aws-0-<region>.pooler.supabase.com:5432/postgres
```

If you don't remember the DB password, reset it under **Settings → Database → Reset password**.

Install the Supabase CLI (handles Postgres version mismatches for you — plain `pg_dump`
often fails with *"server version mismatch"*):

```bash
npm install -g supabase
supabase --version
```

---

## 1. Dump the OLD project

Run from anywhere; produces two files in the current folder.

```bash
# Schema only (structure)
supabase db dump --db-url "<OLD_URL>" -f old-schema.sql

# Data only (rows + sequence values)
supabase db dump --db-url "<OLD_URL>" --data-only -f old-data.sql
```

Sanity-check the dump actually contains rows:

```bash
grep -c "COPY public\." old-data.sql     # should be ~40-66
ls -lh old-data.sql                      # should NOT be a few hundred bytes
```

**Keep `old-data.sql` somewhere safe. This is your only backup.**

---

## 2. Decide: clean rebuild (recommended) vs data-only load

### Option A — Clean rebuild (recommended for your case)

Guarantees the new DB matches the old one exactly. Eliminates any drift between
`schema.sql` + the 29 `migration_*.sql` files and what the old project actually had.

In the **NEW** project's **SQL Editor**, wipe the public schema:

```sql
drop schema public cascade;
create schema public;
grant usage on schema public to postgres, anon, authenticated, service_role;
grant all on schema public to postgres, service_role;
```

Then restore structure + data from your terminal:

```bash
psql "<NEW_URL>" -v ON_ERROR_STOP=1 -f old-schema.sql
psql "<NEW_URL>" -v ON_ERROR_STOP=1 -f old-data.sql
```

### Option B — Keep existing schema, replace data only

Use this if Option A errors out. First clear the seed rows in the **NEW** project:

```sql
-- NEW project SQL Editor — deletes ALL rows in public, keeps tables
do $$
declare r record;
begin
  execute 'set session_replication_role = replica';
  for r in select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('truncate table public.%I cascade', r.tablename);
  end loop;
  execute 'set session_replication_role = origin';
end $$;
```

Then:

```bash
psql "<NEW_URL>" -v ON_ERROR_STOP=1 -f old-data.sql
```

---

## 3. Reset sequences (only needed for Option B)

`--data-only` dumps usually carry `setval()` calls, but verify — otherwise new inserts
collide with existing IDs.

```sql
-- NEW project SQL Editor
do $$
declare r record;
begin
  for r in
    select c.relname as seq,
           t.relname as tbl,
           a.attname as col
    from pg_class c
    join pg_depend d on d.objid = c.oid
    join pg_class t on t.oid = d.refobjid
    join pg_attribute a on a.attrelid = t.oid and a.attnum = d.refobjsubid
    where c.relkind = 'S'
  loop
    execute format(
      'select setval(%L, coalesce((select max(%I) from public.%I), 1))',
      'public.' || r.seq, r.col, r.tbl);
  end loop;
end $$;
```

---

## 4. Verify the row counts match

Run this in **both** dashboards and compare the output side by side:

```sql
select relname as table_name, n_live_tup as rows
from pg_stat_user_tables
where schemaname = 'public' and n_live_tup > 0
order by relname;
```

They should be identical. If the new one is short, something failed in step 2 — check
the `psql` output for errors.

---

## 5. Migrate Storage (photos, logos, symbols)

The SQL dump does **not** include uploaded files. Your DB rows contain full public URLs
pointing at the **old** project, so images will 404 even after the data restores.

1. In the NEW project → **Storage** → create a **public** bucket named `tnr-media`
   (must match `SUPABASE_STORAGE_BUCKET`).
2. Copy the files:

```bash
node scripts/migrate-storage.js
```

(see the script in `scripts/` — set the four env vars it asks for first)

3. Rewrite the stored URLs to point at the new project:

```sql
-- NEW project SQL Editor. Replace both refs with your real project refs.
-- Preview first:
select 'candidates' as t, count(*) from candidates where photo_url like '%<OLD_REF>%'
union all select 'organizations', count(*) from organizations where logo_url like '%<OLD_REF>%'
union all select 'leadership_profiles', count(*) from leadership_profiles where photo_url like '%<OLD_REF>%';

-- Then apply:
update candidates          set photo_url  = replace(photo_url,  '<OLD_REF>', '<NEW_REF>') where photo_url  like '%<OLD_REF>%';
update organizations       set logo_url   = replace(logo_url,   '<OLD_REF>', '<NEW_REF>') where logo_url   like '%<OLD_REF>%';
update leadership_profiles set photo_url  = replace(photo_url,  '<OLD_REF>', '<NEW_REF>') where photo_url  like '%<OLD_REF>%';
update hero_slides         set image_url  = replace(image_url,  '<OLD_REF>', '<NEW_REF>') where image_url  like '%<OLD_REF>%';
update tnr_projects        set image_url  = replace(image_url,  '<OLD_REF>', '<NEW_REF>') where image_url  like '%<OLD_REF>%';
```

Adjust the table/column list to whatever `\d` shows — search for any column ending in
`_url` that stores a Supabase URL.

---

## 6. Confirm on the live site

```
https://mytnrorg.vercel.app/api/public/health     ← row counts per table
https://mytnrorg.vercel.app/api/public/overview   ← should show real voters/candidates
```

If `/health` shows real counts but pages still look empty, it's a cache issue — in Vercel,
**Redeploy → uncheck "Use existing Build Cache"**.

---

## 7. Afterwards

- Reset the admin password on the new project: `node scripts/reset-admin.js <newpassword>`
- Keep `old-data.sql` archived.
- Don't delete the old Supabase project until the new site is verified working for a few days.
