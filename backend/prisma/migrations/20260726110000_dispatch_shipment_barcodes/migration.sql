-- Dispatch shipment barcode tracking (additive)

CREATE TABLE IF NOT EXISTS "dispatch_shipments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "outbound_order_id" UUID NOT NULL,
    "dispatch_task_id" UUID NOT NULL,
    "carrier" TEXT NOT NULL,
    "tracking_number" TEXT NOT NULL,
    "carrier_sync_status" TEXT NOT NULL DEFAULT 'not_supported',
    "carrier_sync_error" TEXT,
    "dispatched_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "dispatch_shipments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "dispatch_shipment_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "shipment_id" UUID NOT NULL,
    "outbound_order_line_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "product_barcode" TEXT NOT NULL,
    "shipped_quantity" DECIMAL(15,4) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "dispatch_shipment_items_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "dispatch_shipments" ADD CONSTRAINT "dispatch_shipments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "dispatch_shipments" ADD CONSTRAINT "dispatch_shipments_outbound_order_id_fkey" FOREIGN KEY ("outbound_order_id") REFERENCES "outbound_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "dispatch_shipments" ADD CONSTRAINT "dispatch_shipments_dispatch_task_id_fkey" FOREIGN KEY ("dispatch_task_id") REFERENCES "warehouse_tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "dispatch_shipments" ADD CONSTRAINT "dispatch_shipments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "dispatch_shipment_items" ADD CONSTRAINT "dispatch_shipment_items_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "dispatch_shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "dispatch_shipment_items" ADD CONSTRAINT "dispatch_shipment_items_outbound_order_line_id_fkey" FOREIGN KEY ("outbound_order_line_id") REFERENCES "outbound_order_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "dispatch_shipment_items" ADD CONSTRAINT "dispatch_shipment_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "dispatch_shipments_outbound_order_id_idx" ON "dispatch_shipments"("outbound_order_id");
CREATE INDEX IF NOT EXISTS "dispatch_shipment_items_shipment_id_idx" ON "dispatch_shipment_items"("shipment_id");
