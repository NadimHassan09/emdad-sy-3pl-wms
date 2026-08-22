DO $$ BEGIN
  CREATE TYPE "order_invoice_status" AS ENUM ('draft', 'issued', 'paid', 'cancelled', 'void');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "order_invoice_charge_type" AS ENUM ('shipping', 'handling', 'packaging', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "order_invoices" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "oms_order_id" UUID,
    "outbound_order_id" UUID,
    "invoice_number" TEXT NOT NULL DEFAULT '',
    "status" "order_invoice_status" NOT NULL DEFAULT 'draft',
    "currency" TEXT NOT NULL DEFAULT 'SYP',
    "subtotal" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "total_charges" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "total_discounts" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "total_taxes" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "grand_total" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "issued_at" TIMESTAMPTZ(6),
    "due_at" TIMESTAMPTZ(6),
    "paid_at" TIMESTAMPTZ(6),
    "notes" TEXT,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "order_invoices_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "order_invoice_lines" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_invoice_id" UUID NOT NULL,
    "product_id" UUID,
    "description" TEXT NOT NULL DEFAULT '',
    "quantity" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "unit_price" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "line_total" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "line_number" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "order_invoice_lines_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "order_invoice_charges" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_invoice_id" UUID NOT NULL,
    "charge_type" "order_invoice_charge_type" NOT NULL DEFAULT 'other',
    "description" TEXT NOT NULL DEFAULT '',
    "amount" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "order_invoice_charges_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "order_invoice_discounts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_invoice_id" UUID NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "amount" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "order_invoice_discounts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "order_invoice_taxes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_invoice_id" UUID NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "rate" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "amount" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "order_invoice_taxes_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN ALTER TABLE "order_invoices" ADD CONSTRAINT "order_invoices_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "order_invoices" ADD CONSTRAINT "order_invoices_oms_order_id_fkey" FOREIGN KEY ("oms_order_id") REFERENCES "oms_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "order_invoices" ADD CONSTRAINT "order_invoices_outbound_order_id_fkey" FOREIGN KEY ("outbound_order_id") REFERENCES "outbound_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "order_invoices" ADD CONSTRAINT "order_invoices_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "order_invoice_lines" ADD CONSTRAINT "order_invoice_lines_order_invoice_id_fkey" FOREIGN KEY ("order_invoice_id") REFERENCES "order_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "order_invoice_lines" ADD CONSTRAINT "order_invoice_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "order_invoice_charges" ADD CONSTRAINT "order_invoice_charges_order_invoice_id_fkey" FOREIGN KEY ("order_invoice_id") REFERENCES "order_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "order_invoice_discounts" ADD CONSTRAINT "order_invoice_discounts_order_invoice_id_fkey" FOREIGN KEY ("order_invoice_id") REFERENCES "order_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "order_invoice_taxes" ADD CONSTRAINT "order_invoice_taxes_order_invoice_id_fkey" FOREIGN KEY ("order_invoice_id") REFERENCES "order_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "order_invoices_company_id_idx" ON "order_invoices"("company_id");
