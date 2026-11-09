CREATE TABLE member_function_roles_ged (
 user_id TEXT NOT NULL REFERENCES users(id),
 role TEXT NOT NULL CHECK(role IN ('pdp_manager','hsee_approver','cse_representative','ticket_label_creator','budget_manager','ged_reviewer')),
 granted_by TEXT REFERENCES users(id), granted_at TEXT NOT NULL,
 PRIMARY KEY(user_id,role)
);
INSERT INTO member_function_roles_ged SELECT * FROM member_function_roles;
DROP TABLE member_function_roles;
ALTER TABLE member_function_roles_ged RENAME TO member_function_roles;
CREATE UNIQUE INDEX one_qsse_budget_manager ON member_function_roles(role) WHERE role='budget_manager';
INSERT INTO member_function_roles(user_id,role,granted_by,granted_at)
SELECT p.user_id,'ged_reviewer',NULL,strftime('%Y-%m-%dT%H:%M:%fZ','now')
FROM ged_profiles p JOIN users u ON u.id=p.user_id
WHERE p.qsse=1 AND u.role IN ('editor','admin');
