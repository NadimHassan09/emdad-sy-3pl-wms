-- BUG-001: Enforce unique (company_id, barcode) among active catalog rows.
-- Archived products are excluded so barcodes may be reused after archive.
-- Replaces the non-unique partial index idx_products_company_barcode.

-- Resolve legacy duplicate active barcodes (keep oldest row per company+barcode).
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY company_id, barcode
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM products
  WHERE barcode IS NOT NULL
    AND status = 'active'
)
UPDATE products AS p
SET barcode = p.barcode || '-DEDUP-' || LEFT(p.id::text, 8)
FROM ranked AS r
WHERE p.id = r.id
  AND r.rn > 1;

DROP INDEX IF EXISTS idx_products_company_barcode;

CREATE UNIQUE INDEX uq_products_company_barcode_active
  ON products (company_id, barcode)
  WHERE barcode IS NOT NULL AND status = 'active';
