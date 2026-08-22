-- Admin Order Execution: plan blob + mode on inbound/outbound (draft save only; no inventory).

ALTER TABLE "inbound_orders"
  ADD COLUMN IF NOT EXISTS "execution_mode" VARCHAR(16),
  ADD COLUMN IF NOT EXISTS "execution_plan" JSONB;

ALTER TABLE "outbound_orders"
  ADD COLUMN IF NOT EXISTS "execution_mode" VARCHAR(16),
  ADD COLUMN IF NOT EXISTS "execution_plan" JSONB;
