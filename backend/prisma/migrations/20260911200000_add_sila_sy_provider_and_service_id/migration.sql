-- Add shipping_service_id column to oms_orders and outbound_orders
ALTER TABLE oms_orders ADD COLUMN IF NOT EXISTS shipping_service_id TEXT;
ALTER TABLE outbound_orders ADD COLUMN IF NOT EXISTS shipping_service_id TEXT;

-- Upsert SILA_SY provider row into shipping_providers table
INSERT INTO shipping_providers (code, name, enabled)
VALUES ('SILA_SY', 'Sila-SY.com', TRUE)
ON CONFLICT (code) DO NOTHING;
