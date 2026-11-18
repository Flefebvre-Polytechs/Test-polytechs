CREATE TABLE vgp_records (
 id TEXT PRIMARY KEY,
 data TEXT NOT NULL,
 revision INTEGER NOT NULL DEFAULT 1,
 updated_at TEXT NOT NULL,
 updated_by TEXT NOT NULL
);
CREATE TABLE vgp_history (
 id TEXT PRIMARY KEY,
 record_id TEXT NOT NULL REFERENCES vgp_records(id),
 snapshot TEXT NOT NULL,
 saved_at TEXT NOT NULL,
 saved_by TEXT NOT NULL
);
CREATE INDEX vgp_history_record ON vgp_history(record_id,saved_at);
CREATE TABLE vgp_files (
 id TEXT PRIMARY KEY,
 record_id TEXT NOT NULL REFERENCES vgp_records(id),
 name TEXT NOT NULL,
 size INTEGER NOT NULL,
 author TEXT NOT NULL,
 created_at TEXT NOT NULL
);
CREATE INDEX vgp_files_record ON vgp_files(record_id);
