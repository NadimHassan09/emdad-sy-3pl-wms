-- PERF-P2B: ledger list + warehouse filter indexes (P1-2, P1-5, P2-4).

CREATE INDEX IF NOT EXISTS idx_ledger_company_movement_created
  ON inventory_ledger (company_id, movement_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ledger_from_location
  ON inventory_ledger (from_location_id)
  WHERE from_location_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ledger_to_location
  ON inventory_ledger (to_location_id)
  WHERE to_location_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_locations_warehouse_active
  ON locations (warehouse_id)
  INCLUDE (id)
  WHERE status = 'active';
