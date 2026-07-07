-- Billing enhancements part 1: enums and schema (enum values must commit before use).

DO $$ BEGIN
  CREATE TYPE "billing_invoice_source" AS ENUM ('cycle', 'ad_hoc');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "billing_discount_type" AS ENUM ('fixed', 'percentage');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "billing_invoice_line_source" AS ENUM ('system', 'manual', 'order');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE "billing_invoice_line_type" ADD VALUE IF NOT EXISTS 'manual';
ALTER TYPE "billing_invoice_line_type" ADD VALUE IF NOT EXISTS 'order_charge';

ALTER TYPE "billing_invoice_status" ADD VALUE IF NOT EXISTS 'unpaid';

ALTER TABLE "billing_plans"
  ADD COLUMN IF NOT EXISTS "outbound_base_fee" DECIMAL(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "outbound_included_items" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "outbound_additional_item_fee" DECIMAL(12, 2) NOT NULL DEFAULT 0;

UPDATE "billing_plans"
SET
  "outbound_base_fee" = COALESCE("outbound_order_fee", 0),
  "outbound_included_items" = 0,
  "outbound_additional_item_fee" = 0
WHERE "outbound_base_fee" = 0 AND "outbound_order_fee" IS NOT NULL;

ALTER TABLE "invoices"
  ADD COLUMN IF NOT EXISTS "invoice_source" "billing_invoice_source" NOT NULL DEFAULT 'cycle',
  ADD COLUMN IF NOT EXISTS "due_date" DATE,
  ADD COLUMN IF NOT EXISTS "subtotal_amount" DECIMAL(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "discount_type" "billing_discount_type",
  ADD COLUMN IF NOT EXISTS "discount_value" DECIMAL(14, 4),
  ADD COLUMN IF NOT EXISTS "discount_amount" DECIMAL(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "vat_percentage" DECIMAL(8, 4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "vat_amount" DECIMAL(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "grand_total" DECIMAL(14, 2) NOT NULL DEFAULT 0;

ALTER TABLE "invoices" ALTER COLUMN "billing_cycle_id" DROP NOT NULL;

UPDATE "invoices"
SET
  "subtotal_amount" = "total_amount",
  "grand_total" = "total_amount"
WHERE "subtotal_amount" = 0 AND "grand_total" = 0;

ALTER TABLE "invoice_lines"
  ADD COLUMN IF NOT EXISTS "line_source" "billing_invoice_line_source" NOT NULL DEFAULT 'system',
  ADD COLUMN IF NOT EXISTS "description" TEXT,
  ADD COLUMN IF NOT EXISTS "order_charge_id" UUID;

CREATE TABLE IF NOT EXISTS "order_manual_charges" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "reference_type" TEXT NOT NULL,
  "reference_id" UUID NOT NULL,
  "description" TEXT NOT NULL,
  "quantity" DECIMAL(15, 4) NOT NULL DEFAULT 1,
  "unit_price" DECIMAL(12, 4) NOT NULL DEFAULT 0,
  "total_price" DECIMAL(14, 2) NOT NULL DEFAULT 0,
  "created_by" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "order_manual_charges_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_order_manual_charges_ref"
  ON "order_manual_charges" ("reference_type", "reference_id");

CREATE INDEX IF NOT EXISTS "idx_order_manual_charges_company"
  ON "order_manual_charges" ("company_id");

CREATE INDEX IF NOT EXISTS "idx_invoice_lines_source"
  ON "invoice_lines" ("invoice_id", "line_source");
