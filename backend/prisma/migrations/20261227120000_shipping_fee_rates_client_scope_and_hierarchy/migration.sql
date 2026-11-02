-- Staging and fresh database shipping fee rates and client scope migration.

-- 1. Base tables creation if not already present
CREATE TABLE IF NOT EXISTS "shipping_fee_settings" (
  "id" TEXT NOT NULL DEFAULT 'default',
  "currency" VARCHAR(8) NOT NULL DEFAULT 'USD',
  "base_weight_kg" NUMERIC(12, 4),
  "increment_kg" NUMERIC(12, 4),
  "increment_charge" NUMERIC(15, 4),
  "rounding_policy" VARCHAR(32) NOT NULL DEFAULT 'ceil_partial',
  "external_per_kg" NUMERIC(15, 4),
  "external_currency" VARCHAR(8),
  "updated_by_user_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "shipping_fee_settings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "shipping_fee_settings" ("id")
VALUES ('default')
ON CONFLICT ("id") DO NOTHING;

CREATE TABLE IF NOT EXISTS "shipping_fee_groups" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID,
  "name_ar" TEXT NOT NULL,
  "name_en" TEXT,
  "area_category" VARCHAR(32) NOT NULL DEFAULT 'custom',
  "base_rate" NUMERIC(15, 4) NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "shipping_fee_groups_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "shipping_fee_groups_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "shipping_fee_group_locations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "group_id" UUID NOT NULL,
  "company_id" UUID,
  "location_key" TEXT NOT NULL,
  "level" VARCHAR(16) NOT NULL,
  "governorate" TEXT NOT NULL,
  "city_region" TEXT,
  "town_neighborhood" TEXT,
  CONSTRAINT "shipping_fee_group_locations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "shipping_fee_group_locations_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "shipping_fee_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "shipping_fee_group_locations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "carrier_cost_changes" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "carrier_shipment_id" UUID NOT NULL,
  "previous_amount" NUMERIC(15, 4),
  "previous_currency" VARCHAR(8),
  "amount" NUMERIC(15, 4) NOT NULL,
  "currency" VARCHAR(8),
  "provider_code" TEXT NOT NULL,
  "external_event_id" TEXT,
  "event_at" TIMESTAMPTZ(6),
  "source" VARCHAR(16) NOT NULL,
  "applied" BOOLEAN NOT NULL DEFAULT true,
  "skip_reason" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "carrier_cost_changes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "carrier_cost_changes_carrier_shipment_id_fkey" FOREIGN KEY ("carrier_shipment_id") REFERENCES "carrier_shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 2. Schema upgrades for existing staging tables (idempotent alterations)
ALTER TABLE "shipping_fee_groups"
  ADD COLUMN IF NOT EXISTS "company_id" UUID;

DO $$ BEGIN
  ALTER TABLE "shipping_fee_groups"
    ADD CONSTRAINT "shipping_fee_groups_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "shipping_fee_group_locations"
  ADD COLUMN IF NOT EXISTS "company_id" UUID,
  ALTER COLUMN "city_region" DROP NOT NULL;

DO $$ BEGIN
  ALTER TABLE "shipping_fee_group_locations"
    ADD CONSTRAINT "shipping_fee_group_locations_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Backfill company_id on locations from their parent group
UPDATE "shipping_fee_group_locations" l
SET "company_id" = g."company_id"
FROM "shipping_fee_groups" g
WHERE l."group_id" = g."id" AND (l."company_id" IS DISTINCT FROM g."company_id");

-- Drop legacy table-wide uniqueness constraint on location_key
ALTER TABLE "shipping_fee_group_locations"
  DROP CONSTRAINT IF EXISTS "shipping_fee_group_locations_location_key_key";
DROP INDEX IF EXISTS "shipping_fee_group_locations_location_key_key";

-- 3. Scope-aware unique indexes:
-- A location can only appear once across global groups (company_id IS NULL)
CREATE UNIQUE INDEX IF NOT EXISTS "uq_fee_locations_global"
  ON "shipping_fee_group_locations" ("location_key")
  WHERE "company_id" IS NULL;

-- A location can only appear once per specific client (company_id IS NOT NULL)
CREATE UNIQUE INDEX IF NOT EXISTS "uq_fee_locations_client"
  ON "shipping_fee_group_locations" ("company_id", "location_key")
  WHERE "company_id" IS NOT NULL;

-- Regular indexes for lookups
CREATE INDEX IF NOT EXISTS "idx_shipping_fee_groups_company"
  ON "shipping_fee_groups" ("company_id");
CREATE INDEX IF NOT EXISTS "idx_shipping_fee_groups_active_sort"
  ON "shipping_fee_groups" ("active", "sort_order");
CREATE INDEX IF NOT EXISTS "idx_shipping_fee_group_locations_group"
  ON "shipping_fee_group_locations" ("group_id");
CREATE INDEX IF NOT EXISTS "idx_shipping_fee_group_locations_lookup"
  ON "shipping_fee_group_locations" ("company_id", "location_key");
CREATE INDEX IF NOT EXISTS "idx_carrier_cost_changes_shipment"
  ON "carrier_cost_changes" ("carrier_shipment_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_carrier_cost_changes_event"
  ON "carrier_cost_changes" ("provider_code", "external_event_id");

-- 4. Order & carrier shipment columns
ALTER TABLE "oms_orders"
  ADD COLUMN IF NOT EXISTS "client_shipping_rate_applied_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "client_shipping_rate_group_id" UUID,
  ADD COLUMN IF NOT EXISTS "client_shipping_rate_weight_kg" NUMERIC(12, 4),
  ADD COLUMN IF NOT EXISTS "client_shipping_rate_breakdown" JSONB;

ALTER TABLE "carrier_shipments"
  ADD COLUMN IF NOT EXISTS "shipping_cost_event_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "shipping_cost_source" VARCHAR(16);
