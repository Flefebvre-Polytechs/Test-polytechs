ALTER TABLE ticket_labels ADD COLUMN deleted_at TEXT;
ALTER TABLE ticket_labels ADD COLUMN deleted_by TEXT REFERENCES users(id) ON DELETE SET NULL;
