CREATE TABLE vgp_passages (
 id TEXT PRIMARY KEY,
 record_id TEXT NOT NULL REFERENCES vgp_records(id),
 due TEXT NOT NULL,
 planned_date TEXT NOT NULL,
 performed_date TEXT NOT NULL,
 result TEXT NOT NULL,
 report_expected INTEGER NOT NULL CHECK(report_expected IN (0,1)),
 note TEXT NOT NULL,
 created_at TEXT NOT NULL,
 created_by TEXT NOT NULL
);
CREATE INDEX vgp_passages_record ON vgp_passages(record_id,performed_date);
ALTER TABLE vgp_files ADD COLUMN passage_id TEXT REFERENCES vgp_passages(id);
