ALTER TABLE sessions ADD COLUMN email_mfa_exempt INTEGER NOT NULL DEFAULT 0 CHECK (email_mfa_exempt IN (0,1));
