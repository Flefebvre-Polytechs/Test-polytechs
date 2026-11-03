CREATE TABLE prevention_invites (
 id TEXT PRIMARY KEY NOT NULL,
 record_id TEXT NOT NULL REFERENCES records(id),
 company TEXT NOT NULL,
 token_hash TEXT NOT NULL UNIQUE,
 created_by TEXT NOT NULL,
 created_at TEXT NOT NULL,
 expires_at INTEGER NOT NULL,
 revoked_at INTEGER
);
CREATE INDEX prevention_invites_record ON prevention_invites(record_id,expires_at);
CREATE TABLE prevention_files (
 id TEXT PRIMARY KEY NOT NULL,
 record_id TEXT NOT NULL REFERENCES records(id),
 invite_id TEXT NOT NULL REFERENCES prevention_invites(id),
 category TEXT NOT NULL,
 name TEXT NOT NULL,
 mime TEXT NOT NULL,
 size INTEGER NOT NULL,
 sha256 TEXT NOT NULL,
 company TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'À examiner' CHECK(status IN ('À examiner','Accepté','Refusé')),
 review_note TEXT NOT NULL DEFAULT '',
 reviewed_by TEXT NOT NULL DEFAULT '',
 reviewed_at TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL
);
CREATE INDEX prevention_files_record ON prevention_files(record_id,created_at);
