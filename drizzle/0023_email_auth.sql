-- Additive migration. Rollback: deploy previous code; retain these security records.
ALTER TABLE sessions ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0;
CREATE TABLE auth_challenges (
 token_hash TEXT PRIMARY KEY NOT NULL,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 purpose TEXT NOT NULL CHECK(purpose IN ('login','reset')),
 secret_hash TEXT NOT NULL,
 email TEXT NOT NULL,
 password_snapshot TEXT NOT NULL,
 expires_at INTEGER NOT NULL,
 attempts INTEGER NOT NULL DEFAULT 0,
 used_at INTEGER,
 claim TEXT
);
CREATE INDEX auth_challenges_user ON auth_challenges(user_id,purpose,expires_at);
