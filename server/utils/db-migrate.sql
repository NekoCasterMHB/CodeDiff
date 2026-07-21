-- Migration: Add missing columns to existing diffs table
ALTER TABLE diffs ADD COLUMN owner_token TEXT;
ALTER TABLE diffs ADD COLUMN share_group TEXT;
ALTER TABLE diffs ADD COLUMN segment_index INTEGER DEFAULT 0;
ALTER TABLE diffs ADD COLUMN total_segments INTEGER DEFAULT 1;
CREATE INDEX IF NOT EXISTS idx_diffs_share_group ON diffs(share_group);
