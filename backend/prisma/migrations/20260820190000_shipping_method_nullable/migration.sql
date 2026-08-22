-- Align DB with Prisma: shipping_method is unset until Waiting for Shipping Method.
-- Explicit NULL on create was failing against NOT NULL DEFAULT 'manual'.
ALTER TABLE oms_orders
  ALTER COLUMN shipping_method DROP DEFAULT,
  ALTER COLUMN shipping_method DROP NOT NULL;

ALTER TABLE outbound_orders
  ALTER COLUMN shipping_method DROP DEFAULT,
  ALTER COLUMN shipping_method DROP NOT NULL;
