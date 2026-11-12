CREATE TABLE IF NOT EXISTS epi_technical_sheets (
 code TEXT PRIMARY KEY REFERENCES epi_products(code) ON DELETE CASCADE,
 object_key TEXT NOT NULL,
 name TEXT NOT NULL,
 size INTEGER NOT NULL,
 version TEXT NOT NULL,
 author TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
