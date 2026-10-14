-- Additive COD collection fields and a single-row FX settings table.
-- Original cod_amount and currency are not rewritten.

ALTER TABLE "outbound_orders"
  ADD COLUMN IF NOT EXISTS "cod_collection_currency" VARCHAR(8),
  ADD COLUMN IF NOT EXISTS "cod_collection_amount" DECIMAL(15,4),
  ADD COLUMN IF NOT EXISTS "cod_fx_rate" DECIMAL(18,6),
  ADD COLUMN IF NOT EXISTS "cod_fx_source" VARCHAR(64),
  ADD COLUMN IF NOT EXISTS "cod_fx_at" TIMESTAMPTZ(6);

ALTER TABLE "oms_orders"
  ADD COLUMN IF NOT EXISTS "cod_collection_currency" VARCHAR(8),
  ADD COLUMN IF NOT EXISTS "cod_collection_amount" DECIMAL(15,4),
  ADD COLUMN IF NOT EXISTS "cod_fx_rate" DECIMAL(18,6),
  ADD COLUMN IF NOT EXISTS "cod_fx_source" VARCHAR(64),
  ADD COLUMN IF NOT EXISTS "cod_fx_at" TIMESTAMPTZ(6);

CREATE TABLE IF NOT EXISTS "shipping_fx_settings" (
  "id" TEXT NOT NULL DEFAULT 'default',
  "mode" VARCHAR(16) NOT NULL DEFAULT 'manual',
  "manual_rate" DECIMAL(18,6),
  "auto_source" VARCHAR(64),
  "last_auto_rate" DECIMAL(18,6),
  "last_auto_at" TIMESTAMPTZ(6),
  "last_error" TEXT,
  "updated_by_user_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "shipping_fx_settings_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "shipping_fx_settings"
    ADD CONSTRAINT "shipping_fx_settings_updated_by_user_id_fkey"
    FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
