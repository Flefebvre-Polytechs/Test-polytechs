CREATE TABLE hub_run_history (
  run_id TEXT NOT NULL REFERENCES hub_runs(id),
  revision INTEGER NOT NULL,
  snapshot TEXT NOT NULL,
  author TEXT NOT NULL,
  saved_at TEXT NOT NULL,
  PRIMARY KEY (run_id, revision)
);
