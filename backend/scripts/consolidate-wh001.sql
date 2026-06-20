-- Consolidate operational data under WH-001 and remove duplicate warehouse rows.
-- Safe to re-run: only touches non-WH-001 warehouse_id values and empty warehouse records.

BEGIN;

\set wh001_id '00000000-0000-4000-8000-000000000010'

UPDATE current_stock
SET warehouse_id = :'wh001_id'
WHERE warehouse_id IS DISTINCT FROM :'wh001_id';

UPDATE workflow_instances
SET warehouse_id = :'wh001_id'
WHERE warehouse_id IS DISTINCT FROM :'wh001_id';

UPDATE workers
SET warehouse_id = :'wh001_id'
WHERE warehouse_id IS DISTINCT FROM :'wh001_id';

UPDATE stock_adjustments
SET warehouse_id = :'wh001_id'
WHERE warehouse_id IS NOT NULL AND warehouse_id IS DISTINCT FROM :'wh001_id';

UPDATE cycle_counts
SET warehouse_id = :'wh001_id'
WHERE warehouse_id IS NOT NULL AND warehouse_id IS DISTINCT FROM :'wh001_id';

UPDATE cycle_count_variances
SET warehouse_id = :'wh001_id'
WHERE warehouse_id IS NOT NULL AND warehouse_id IS DISTINCT FROM :'wh001_id';

UPDATE cycle_count_schedules
SET warehouse_id = :'wh001_id'
WHERE warehouse_id IS NOT NULL AND warehouse_id IS DISTINCT FROM :'wh001_id';

UPDATE cycle_count_product_history
SET warehouse_id = :'wh001_id'
WHERE warehouse_id IS NOT NULL AND warehouse_id IS DISTINCT FROM :'wh001_id';

UPDATE return_orders
SET warehouse_id = :'wh001_id'
WHERE warehouse_id IS NOT NULL AND warehouse_id IS DISTINCT FROM :'wh001_id';

-- Remove empty non-primary warehouses (no locations, stock, workflows, or workers).
DELETE FROM warehouses w
WHERE w.id <> :'wh001_id'
  AND NOT EXISTS (SELECT 1 FROM locations l WHERE l.warehouse_id = w.id)
  AND NOT EXISTS (SELECT 1 FROM current_stock cs WHERE cs.warehouse_id = w.id)
  AND NOT EXISTS (SELECT 1 FROM workflow_instances wi WHERE wi.warehouse_id = w.id)
  AND NOT EXISTS (SELECT 1 FROM workers wr WHERE wr.warehouse_id = w.id)
  AND NOT EXISTS (SELECT 1 FROM stock_adjustments sa WHERE sa.warehouse_id = w.id)
  AND NOT EXISTS (SELECT 1 FROM cycle_counts cc WHERE cc.warehouse_id = w.id)
  AND NOT EXISTS (SELECT 1 FROM return_orders ro WHERE ro.warehouse_id = w.id);

COMMIT;
