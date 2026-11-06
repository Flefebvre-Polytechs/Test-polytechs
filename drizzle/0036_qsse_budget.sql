CREATE TABLE member_function_roles_budget (
 user_id TEXT NOT NULL REFERENCES users(id),
 role TEXT NOT NULL CHECK(role IN ('pdp_manager','hsee_approver','cse_representative','ticket_label_creator','budget_manager')),
 granted_by TEXT REFERENCES users(id), granted_at TEXT NOT NULL,
 PRIMARY KEY(user_id,role)
);
INSERT INTO member_function_roles_budget SELECT * FROM member_function_roles;
DROP TABLE member_function_roles;
ALTER TABLE member_function_roles_budget RENAME TO member_function_roles;
CREATE UNIQUE INDEX one_qsse_budget_manager ON member_function_roles(role) WHERE role='budget_manager';
CREATE TABLE qsse_budget_owner (singleton INTEGER PRIMARY KEY CHECK(singleton=1),user_id TEXT NOT NULL REFERENCES users(id));
INSERT INTO qsse_budget_owner SELECT 1,id FROM users WHERE lower(trim(email))='karine.connan@polytechs.fr' AND role IN ('editor','admin') AND (SELECT count(*) FROM users WHERE lower(trim(email))='karine.connan@polytechs.fr')=1;
INSERT INTO member_function_roles SELECT user_id,'budget_manager',NULL,strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM qsse_budget_owner;
CREATE TABLE qsse_budget_data (id TEXT PRIMARY KEY,data TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 1,updated_at TEXT NOT NULL,updated_by TEXT NOT NULL);
CREATE TABLE qsse_budget_history (id TEXT PRIMARY KEY,record_id TEXT NOT NULL,snapshot TEXT NOT NULL,saved_at TEXT NOT NULL,saved_by TEXT NOT NULL);
CREATE TABLE qsse_budget_import (id INTEGER PRIMARY KEY CHECK(id=1),sha TEXT NOT NULL,metadata TEXT NOT NULL,created_at TEXT NOT NULL,created_by TEXT NOT NULL);
