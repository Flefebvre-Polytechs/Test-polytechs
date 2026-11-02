CREATE TABLE epi_photos (
  code TEXT PRIMARY KEY NOT NULL REFERENCES epi_products(code) ON DELETE CASCADE,
  object_key TEXT NOT NULL,
  author TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
