-- Add optional shipment volume (m³), separate from product master volumeCbm.
ALTER TABLE "outbound_orders"
  ADD COLUMN IF NOT EXISTS "shipping_volume_cbm" DECIMAL(12,6);

ALTER TABLE "oms_orders"
  ADD COLUMN IF NOT EXISTS "shipping_volume_cbm" DECIMAL(12,6);
