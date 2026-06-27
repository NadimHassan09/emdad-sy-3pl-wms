-- Customer Lifecycle Management: extend status enum and add lifecycle columns.

-- New lifecycle states (kept alongside legacy values for backward compatibility).
ALTER TYPE "company_status" ADD VALUE IF NOT EXISTS 'suspended';
ALTER TYPE "company_status" ADD VALUE IF NOT EXISTS 'archived';
ALTER TYPE "company_status" ADD VALUE IF NOT EXISTS 'purged';

-- Lifecycle audit columns on the company record.
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "suspended_at" TIMESTAMPTZ(6);
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "suspended_by" UUID;
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "suspension_reason" TEXT;
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMPTZ(6);
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "archived_by" UUID;
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "archive_reason" TEXT;
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "purged_at" TIMESTAMPTZ(6);
