CREATE TABLE member_function_roles (
 user_id TEXT NOT NULL REFERENCES users(id),
 role TEXT NOT NULL CHECK(role IN ('pdp_manager','hsee_approver','cse_representative')),
 granted_by TEXT REFERENCES users(id),
 granted_at TEXT NOT NULL,
 PRIMARY KEY(user_id,role)
);
-- Preserve existing explicit HSEE/QSSE coordination rights as named assignments.
INSERT OR IGNORE INTO member_function_roles(user_id,role,granted_by,granted_at)
 SELECT DISTINCT u.id,'hsee_approver',NULL,strftime('%Y-%m-%dT%H:%M:%fZ','now')
 FROM users u JOIN team_members m ON m.user_id=u.id
 WHERE m.team_id IN ('qsse','hsee') AND m.level IN ('contributor','team_admin') AND u.role IN ('editor','admin');
CREATE TABLE notification_receipts (
 notification_id TEXT PRIMARY KEY NOT NULL REFERENCES hub_notifications(id) ON DELETE CASCADE,
 user_id TEXT NOT NULL REFERENCES users(id),
 acknowledged_at TEXT,
 deferred_session TEXT,
 deferred_at TEXT
);
CREATE INDEX notification_receipts_user ON notification_receipts(user_id,acknowledged_at);
