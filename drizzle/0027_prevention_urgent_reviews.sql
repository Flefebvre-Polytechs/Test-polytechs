CREATE TABLE prevention_urgent_reviews (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 record_id TEXT NOT NULL REFERENCES records(id),
 scope_hash TEXT NOT NULL,
 decision TEXT NOT NULL CHECK(decision IN ('Demandée','Approuvée','Refusée')),
 reason TEXT NOT NULL,
 author_id TEXT NOT NULL REFERENCES users(id),
 author TEXT NOT NULL,
 created_at TEXT NOT NULL
);
CREATE INDEX idx_prevention_urgent_scope ON prevention_urgent_reviews(record_id,scope_hash,id);
