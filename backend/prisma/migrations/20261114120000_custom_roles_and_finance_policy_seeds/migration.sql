-- O-11: Custom roles with editable module×action permissions (additive, no data loss).
-- B12/B15: seed financial policy keys (upsert-safe). Staging only.

CREATE TABLE IF NOT EXISTS "custom_roles" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" VARCHAR(80) NOT NULL,
  "description" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_by" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "custom_roles_name_key"
  ON "custom_roles" ("name");

CREATE TABLE IF NOT EXISTS "custom_role_permissions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "role_id" UUID NOT NULL REFERENCES "custom_roles"("id") ON DELETE CASCADE,
  "module" VARCHAR(64) NOT NULL,
  "action" VARCHAR(32) NOT NULL,
  "allowed" BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT "uq_custom_role_permissions_role_module_action"
    UNIQUE ("role_id", "module", "action")
);

CREATE INDEX IF NOT EXISTS "idx_custom_role_permissions_role"
  ON "custom_role_permissions" ("role_id");

-- Optional link from users to a custom role (built-in user_role enum unchanged).
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "custom_role_id" UUID
    REFERENCES "custom_roles"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "idx_users_custom_role_id"
  ON "users" ("custom_role_id")
  WHERE "custom_role_id" IS NOT NULL;

-- B12 / B15 policy seeds (FinancialPolicy key/value; ON CONFLICT DO NOTHING).
INSERT INTO "financial_policies" ("id", "key", "value", "description", "updated_at")
VALUES
  (gen_random_uuid(), 'in_transit_float_enabled', 'false',
   'B12 — Enable in-transit COD float indicator (admin finance views)', NOW()),
  (gen_random_uuid(), 'carrier_reconciliation_enabled', 'false',
   'B12 — Enable carrier remittance reconciliation module', NOW()),
  (gen_random_uuid(), 'client_shield_enabled', 'true',
   'B12 — Hide in-transit / reconciliation gap figures from the client portal', NOW()),
  (gen_random_uuid(), 'liquidity_gap_mode', 'none',
   'B15 — Liquidity bridge until remittance: none | float | prep_fee', NOW()),
  (gen_random_uuid(), 'prep_fee_enabled', 'false',
   'B15 — Charge a prep fee while COD is outstanding', NOW()),
  (gen_random_uuid(), 'prep_fee_percent', '0',
   'B15 — Prep fee percent of COD (0–100) when prep_fee_enabled', NOW())
ON CONFLICT ("key") DO NOTHING;
