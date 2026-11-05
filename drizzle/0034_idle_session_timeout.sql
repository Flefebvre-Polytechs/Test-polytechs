-- Normal sessions expire after 15 minutes without an explicit user activity ping.
-- Device-only EPI scan tokens retain their separate 90-day policy and never use this column.
ALTER TABLE sessions ADD COLUMN last_activity_at INTEGER NOT NULL DEFAULT 0;
-- Existing main-site sessions get a fresh 15-minute transition window after deployment.
UPDATE sessions SET last_activity_at = CAST(strftime('%s','now') AS INTEGER) * 1000
 WHERE expires_at > CAST(strftime('%s','now') AS INTEGER) * 1000;
CREATE INDEX idx_sessions_idle ON sessions(last_activity_at);
