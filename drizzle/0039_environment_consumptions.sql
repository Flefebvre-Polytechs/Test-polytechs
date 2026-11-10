-- Monthly measured consumptions and optional targets, separated by real site and metric.
-- NULL = no reading/target recorded; never treat missing as zero.
CREATE TABLE env_consumption_records (
  id TEXT PRIMARY KEY NOT NULL,
  site TEXT NOT NULL CHECK(site IN ('site-1','site-2')),
  period TEXT NOT NULL CHECK(length(period)=7 AND substr(period,5,1)='-'),
  metric TEXT NOT NULL,
  value REAL CHECK(value IS NULL OR (value >= 0 AND value <= 1000000000)),
  target REAL CHECK(target IS NULL OR (target >= 0 AND target <= 1000000000)),
  note TEXT NOT NULL DEFAULT '',
  revision INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  UNIQUE(site,period,metric)
);
CREATE INDEX idx_env_consumption_period ON env_consumption_records(period,site);
CREATE TABLE env_consumption_history (
  id TEXT PRIMARY KEY NOT NULL,
  record_id TEXT NOT NULL REFERENCES env_consumption_records(id),
  previous_snapshot TEXT NOT NULL,
  new_snapshot TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  actor TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_env_consumption_history ON env_consumption_history(record_id,created_at);
