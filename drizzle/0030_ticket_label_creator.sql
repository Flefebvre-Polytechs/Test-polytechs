CREATE TABLE member_function_roles_new (
 user_id TEXT NOT NULL REFERENCES users(id),
 role TEXT NOT NULL CHECK(role IN ('pdp_manager','hsee_approver','cse_representative','ticket_label_creator')),
 granted_by TEXT REFERENCES users(id),
 granted_at TEXT NOT NULL,
 PRIMARY KEY(user_id,role)
);
INSERT INTO member_function_roles_new SELECT user_id,role,granted_by,granted_at FROM member_function_roles;
DROP TABLE member_function_roles;
ALTER TABLE member_function_roles_new RENAME TO member_function_roles;
