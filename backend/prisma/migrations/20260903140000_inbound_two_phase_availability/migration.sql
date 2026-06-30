-- Inbound two-phase availability: received goods are on-hand but NOT available
-- for picking/allocation until a putaway task confirms the final bin/location.
-- Adds a dedicated stock status so receiving-area inventory is excluded from
-- FEFO allocation and availability reads until it is put away.

ALTER TYPE "stock_status" ADD VALUE IF NOT EXISTS 'awaiting_putaway';
