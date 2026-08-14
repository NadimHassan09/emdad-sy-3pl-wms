-- Auto-renewal flag for billing plans (default on for new and existing rows).
ALTER TABLE "billing_plans"
  ADD COLUMN IF NOT EXISTS "auto_renew" BOOLEAN NOT NULL DEFAULT true;
