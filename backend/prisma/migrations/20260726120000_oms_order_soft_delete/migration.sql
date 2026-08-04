ALTER TABLE "oms_orders" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ(6);
ALTER TABLE "oms_orders" ADD COLUMN IF NOT EXISTS "deleted_by" UUID;
ALTER TABLE "oms_orders" ADD COLUMN IF NOT EXISTS "cod_status_changed_at" TIMESTAMPTZ(6);
ALTER TABLE "oms_orders" ADD COLUMN IF NOT EXISTS "cod_status_changed_by" UUID;
DO $$ BEGIN
  ALTER TABLE "oms_orders" ADD CONSTRAINT "oms_orders_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "oms_orders" ADD CONSTRAINT "oms_orders_cod_status_changed_by_fkey" FOREIGN KEY ("cod_status_changed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "oms_orders_deleted_at_idx" ON "oms_orders"("deleted_at");
