-- Sprint 2: Client Portal bulk import incomplete-order marker.
-- Additive only. Does not rewrite existing OMS rows.

ALTER TABLE "oms_orders"
  ADD COLUMN IF NOT EXISTS "needs_information" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "import_batch_id" UUID;

CREATE INDEX IF NOT EXISTS "idx_oms_orders_import_batch"
  ON "oms_orders" ("import_batch_id");
