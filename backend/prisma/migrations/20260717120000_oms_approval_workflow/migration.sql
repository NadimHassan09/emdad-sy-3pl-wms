-- Additive OMS approval workflow: new statuses + approval metadata.
-- No DROP / DELETE / TRUNCATE.

ALTER TYPE "oms_order_status" ADD VALUE IF NOT EXISTS 'pending_approval';
ALTER TYPE "oms_order_status" ADD VALUE IF NOT EXISTS 'rejected';
ALTER TYPE "oms_order_status" ADD VALUE IF NOT EXISTS 'approved';
ALTER TYPE "oms_order_status" ADD VALUE IF NOT EXISTS 'picking';
ALTER TYPE "oms_order_status" ADD VALUE IF NOT EXISTS 'packing';
ALTER TYPE "oms_order_status" ADD VALUE IF NOT EXISTS 'failed_delivery';
ALTER TYPE "oms_order_status" ADD VALUE IF NOT EXISTS 'completed';

ALTER TABLE "oms_orders"
  ADD COLUMN IF NOT EXISTS "submitted_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "approved_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "approved_by" UUID,
  ADD COLUMN IF NOT EXISTS "rejected_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "rejected_by" UUID,
  ADD COLUMN IF NOT EXISTS "rejection_reason" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'oms_orders_approved_by_fkey'
  ) THEN
    ALTER TABLE "oms_orders"
      ADD CONSTRAINT "oms_orders_approved_by_fkey"
      FOREIGN KEY ("approved_by") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'oms_orders_rejected_by_fkey'
  ) THEN
    ALTER TABLE "oms_orders"
      ADD CONSTRAINT "oms_orders_rejected_by_fkey"
      FOREIGN KEY ("rejected_by") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "idx_oms_orders_status"
  ON "oms_orders" ("company_id", "status");
