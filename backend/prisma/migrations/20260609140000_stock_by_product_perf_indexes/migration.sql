-- PERF-P2A: push stock-by-product aggregation to PostgreSQL with covering index + sort helper.

DROP INDEX IF EXISTS idx_stock_company_product;

CREATE INDEX idx_stock_company_product
  ON current_stock (company_id, product_id)
  INCLUDE (quantity_on_hand)
  WHERE quantity_on_hand > 0;

CREATE INDEX IF NOT EXISTS idx_products_company_name
  ON products (company_id, name);
