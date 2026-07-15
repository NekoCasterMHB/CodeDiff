-- CodeDiff D1 Database Initialization
-- Run this to set up the database schema in Cloudflare D1

CREATE TABLE IF NOT EXISTS diffs (
  id TEXT PRIMARY KEY,
  encrypted_data TEXT NOT NULL,
  iv TEXT NOT NULL,
  salt TEXT NOT NULL,
  file_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_diffs_created_at ON diffs(created_at);
