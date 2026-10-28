-- Retain the last saved snapshot and actor when removing a QSE register entry.
-- Existing record_history rows are deliberately retained.
CREATE TABLE record_deletions (
  record_id TEXT PRIMARY KEY NOT NULL,
  revision INTEGER NOT NULL,
  snapshot TEXT NOT NULL,
  deleted_at TEXT NOT NULL,
  deleted_by TEXT NOT NULL
);
