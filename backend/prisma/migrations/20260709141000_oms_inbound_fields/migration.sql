-- Inbound OMS metadata (optional; legacy rows remain valid).

ALTER TABLE inbound_orders
  ADD COLUMN IF NOT EXISTS source_type inbound_source_type;

ALTER TABLE inbound_orders
  ADD COLUMN IF NOT EXISTS store_channel TEXT;

ALTER TABLE inbound_orders
  ADD COLUMN IF NOT EXISTS external_reference TEXT;

CREATE INDEX IF NOT EXISTS idx_inbound_orders_source_type
  ON inbound_orders (company_id, source_type)
  WHERE source_type IS NOT NULL;
