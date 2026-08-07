# Supabase Storage

Create a **public** bucket named `tnr-media` (or match `SUPABASE_STORAGE_BUCKET`).

- `candidates/` — candidate photos
- `org/`        — organization logo

Uploads are done server-side via the service role key (see `lib/storage.js`).
