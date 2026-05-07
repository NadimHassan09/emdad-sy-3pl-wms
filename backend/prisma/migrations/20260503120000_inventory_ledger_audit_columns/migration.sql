-- Prisma `InventoryLedger.quantityBefore` / `quantityAfter` (nullable for legacy rows).
-- Baseline 0_init omitted these; bootstrap-db.js added them ad hoc — migrate-only installs need this.

ALTER TABLE inventory_ledger ADD COLUMN IF NOT EXISTS quantity_before DECIMAL(15,4);
ALTER TABLE inventory_ledger ADD COLUMN IF NOT EXISTS quantity_after DECIMAL(15,4);
