-- OMS sales channel registry for future Shopify / WooCommerce / Salla / Zid / custom REST integrations.

CREATE TYPE "oms_sales_channel_type" AS ENUM (
  'shopify',
  'woocommerce',
  'salla',
  'zid',
  'custom_rest'
);

CREATE TABLE "oms_sales_channels" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "channel_type" "oms_sales_channel_type" NOT NULL,
  "name" TEXT NOT NULL,
  "external_store_id" TEXT,
  "webhook_secret_hash" TEXT NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "config" JSONB,
  "last_sync_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "oms_sales_channels_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_oms_sales_channels_company" ON "oms_sales_channels"("company_id");
CREATE UNIQUE INDEX "idx_oms_sales_channels_company_type_store"
  ON "oms_sales_channels"("company_id", "channel_type", "external_store_id")
  WHERE "external_store_id" IS NOT NULL;

ALTER TABLE "oms_sales_channels"
  ADD CONSTRAINT "oms_sales_channels_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "oms_integration_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "sales_channel_id" UUID,
  "outbound_order_id" UUID,
  "event_type" TEXT NOT NULL,
  "external_id" TEXT,
  "payload" JSONB,
  "status" TEXT NOT NULL DEFAULT 'received',
  "error_message" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "oms_integration_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_oms_integration_events_company" ON "oms_integration_events"("company_id", "created_at" DESC);
CREATE INDEX "idx_oms_integration_events_channel" ON "oms_integration_events"("sales_channel_id", "created_at" DESC);

ALTER TABLE "oms_integration_events"
  ADD CONSTRAINT "oms_integration_events_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "oms_integration_events"
  ADD CONSTRAINT "oms_integration_events_sales_channel_id_fkey"
  FOREIGN KEY ("sales_channel_id") REFERENCES "oms_sales_channels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "oms_integration_events"
  ADD CONSTRAINT "oms_integration_events_outbound_order_id_fkey"
  FOREIGN KEY ("outbound_order_id") REFERENCES "outbound_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "outbound_orders" ADD COLUMN IF NOT EXISTS "store_channel" TEXT;
ALTER TABLE "outbound_orders" ADD COLUMN IF NOT EXISTS "external_reference" TEXT;
