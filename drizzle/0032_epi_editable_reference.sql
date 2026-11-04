-- Garder le code historique comme identifiant stable des QR codes, stocks, photos et dotations.
ALTER TABLE epi_products ADD COLUMN supplier_reference TEXT NOT NULL DEFAULT '';
UPDATE epi_products SET supplier_reference=code WHERE trim(supplier_reference)='';
CREATE TABLE epi_product_edits (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL REFERENCES epi_products(code),
  before_json TEXT NOT NULL,
  after_json TEXT NOT NULL,
  author TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_epi_product_edits_code ON epi_product_edits(code,created_at);
