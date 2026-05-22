-- Outbound orders: optional pack step before dispatch (pick → delivery area → dispatch).
ALTER TABLE "outbound_orders"
  ADD COLUMN IF NOT EXISTS "requires_packing" BOOLEAN NOT NULL DEFAULT true;
