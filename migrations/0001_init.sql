-- D1 schema for Open Template Library.
-- Mirrors db/schema.json (the four community tables) and adds the bookkeeping
-- the backend needs: an optional moderation status and the AI usage counter.

CREATE TABLE IF NOT EXISTS community_templates (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL DEFAULT '',
  category    TEXT NOT NULL DEFAULT '',
  author_name TEXT NOT NULL DEFAULT '',
  content     TEXT NOT NULL DEFAULT '{}',
  shared_on   TEXT,
  uses        INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS community_templates_shared ON community_templates (shared_on);
CREATE INDEX IF NOT EXISTS community_templates_category ON community_templates (category);

CREATE TABLE IF NOT EXISTS shared_templates (
  id                TEXT PRIMARY KEY,
  title             TEXT NOT NULL DEFAULT '',
  category          TEXT NOT NULL DEFAULT '',
  author_name       TEXT NOT NULL DEFAULT '',
  content           TEXT NOT NULL DEFAULT '{}',
  confirmed_removed INTEGER NOT NULL DEFAULT 0,
  status            TEXT NOT NULL DEFAULT 'pending',
  ip_hash           TEXT,
  created_at        TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS shared_templates_status ON shared_templates (status, created_at);
CREATE INDEX IF NOT EXISTS shared_templates_ip ON shared_templates (ip_hash, created_at);

CREATE TABLE IF NOT EXISTS template_reports (
  id             TEXT PRIMARY KEY,
  template_id    TEXT NOT NULL,
  template_title TEXT NOT NULL DEFAULT '',
  reason         TEXT NOT NULL DEFAULT '',
  created_at     TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS template_reports_template ON template_reports (template_id, created_at);

CREATE TABLE IF NOT EXISTS template_copies (
  id          TEXT PRIMARY KEY,
  template_id TEXT NOT NULL,
  created_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS template_copies_template ON template_copies (template_id, created_at);

CREATE TABLE IF NOT EXISTS ai_usage (
  id         TEXT PRIMARY KEY,
  ip_hash    TEXT NOT NULL,
  day        TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS ai_usage_day ON ai_usage (day, ip_hash);
