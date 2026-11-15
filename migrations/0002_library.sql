-- The form library: one row per document kept in R2.
--
-- The bytes live in the FILES bucket; this table holds what is worth querying —
-- which form it is, which revision of it, whether it was decrypted, how many
-- fillable fields it has. form_number is unique so pulling FL-320 twice updates
-- the one row instead of stacking copies; uploads have form_number NULL and each
-- keep their own row (SQLite treats NULLs as distinct in a unique index).

CREATE TABLE IF NOT EXISTS library_documents (
  id           TEXT PRIMARY KEY,
  form_number  TEXT,
  title        TEXT NOT NULL DEFAULT '',
  kind         TEXT NOT NULL DEFAULT 'pdf',
  packet       TEXT,
  r2_key       TEXT NOT NULL,
  bytes        INTEGER NOT NULL DEFAULT 0,
  sha256       TEXT NOT NULL DEFAULT '',
  content_type TEXT NOT NULL DEFAULT 'application/pdf',
  filename     TEXT NOT NULL DEFAULT '',
  revision     TEXT,
  source_url   TEXT,
  pages        INTEGER,
  field_count  INTEGER,
  -- stored: the bytes are in R2, readable as published. encrypted: kept as
  -- published, with the blank password not removed yet. decrypted: the password
  -- was removed. fillable: the form fields were read and can be filled.
  -- superseded: the source has been revised since this copy was pulled.
  status       TEXT NOT NULL DEFAULT 'stored',
  fetched_at   TEXT NOT NULL,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS library_documents_form ON library_documents (form_number);
CREATE INDEX IF NOT EXISTS library_documents_packet ON library_documents (packet);
CREATE INDEX IF NOT EXISTS library_documents_updated ON library_documents (updated_at);
