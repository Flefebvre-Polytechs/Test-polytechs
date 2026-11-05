CREATE TABLE ticket_import_reversals (
 id TEXT PRIMARY KEY NOT NULL,
 batch_sha TEXT NOT NULL,
 source TEXT NOT NULL,
 snapshot TEXT NOT NULL,
 ticket_count INTEGER NOT NULL,
 removed_at TEXT NOT NULL,
 removed_by TEXT NOT NULL,
 restored_at TEXT
);
