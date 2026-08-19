-- Client Portal integration API credentials (one scope per key).
CREATE TYPE "api_credential_scope" AS ENUM ('oms', 'inbound', 'outbound');

CREATE TABLE "api_credentials" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "scope" "api_credential_scope" NOT NULL,
  "api_key" TEXT NOT NULL,
  "key_prefix" TEXT NOT NULL,
  "secret_hash" TEXT NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "last_used_at" TIMESTAMPTZ(6),
  "created_by_user_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "revoked_at" TIMESTAMPTZ(6),
  "revoked_by_user_id" UUID,
  CONSTRAINT "api_credentials_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "api_credentials_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "api_credentials_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "api_credentials_revoked_by_user_id_fkey" FOREIGN KEY ("revoked_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "api_credentials_api_key_key" ON "api_credentials"("api_key");
CREATE INDEX "idx_api_credentials_company" ON "api_credentials"("company_id", "created_at" DESC);

-- Idempotent external order references per company (API + CSV).
CREATE UNIQUE INDEX "idx_oms_orders_company_ext_ref"
  ON "oms_orders" ("company_id", (lower(btrim("external_reference"))))
  WHERE "external_reference" IS NOT NULL AND btrim("external_reference") <> '';

CREATE UNIQUE INDEX "idx_inbound_orders_company_ext_ref"
  ON "inbound_orders" ("company_id", (lower(btrim("external_reference"))))
  WHERE "external_reference" IS NOT NULL AND btrim("external_reference") <> '';

CREATE UNIQUE INDEX "idx_outbound_orders_company_ext_ref"
  ON "outbound_orders" ("company_id", (lower(btrim("external_reference"))))
  WHERE "external_reference" IS NOT NULL AND btrim("external_reference") <> '';
