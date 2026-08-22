-- PERF-NORM-1: Single-warehouse dataset normalization (wms_db_staging only)
-- Run: psql -h localhost -U wms_user -d wms_db_staging -v ON_ERROR_STOP=1 -f scripts/perf-norm-1-migrate.sql

\set ON_ERROR_STOP on
\timing on

-- Bypass tenant RLS for maintenance (internal role)
SELECT set_config('app.user_role', 'super_admin', true);
SELECT set_config('app.current_user_id', '00000000-0000-4000-8000-0000000000aa', true);

CREATE TABLE IF NOT EXISTS _perf_norm_metrics (
  step       TEXT NOT NULL,
  metric     TEXT NOT NULL,
  value_num  NUMERIC,
  value_text TEXT,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

TRUNCATE _perf_norm_metrics;

INSERT INTO _perf_norm_metrics (step, metric, value_num)
SELECT 'pre', 'stock_rows', COUNT(*)::numeric FROM current_stock
UNION ALL SELECT 'pre', 'stock_qty_on_hand', SUM(quantity_on_hand) FROM current_stock
UNION ALL SELECT 'pre', 'stock_in_wh001', COUNT(*)::numeric FROM current_stock cs
  JOIN warehouses w ON w.id = cs.warehouse_id WHERE w.code = 'WH-001'
UNION ALL SELECT 'pre', 'tasks_in_wh001', COUNT(*)::numeric FROM warehouse_tasks wt
  JOIN workflow_instances wi ON wi.id = wt.workflow_instance_id
  JOIN warehouses w ON w.id = wi.warehouse_id WHERE w.code = 'WH-001'
UNION ALL SELECT 'pre', 'workflow_in_wh001', COUNT(*)::numeric FROM workflow_instances wi
  JOIN warehouses w ON w.id = wi.warehouse_id WHERE w.code = 'WH-001';

-- ---------------------------------------------------------------------------
-- Constants
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE _norm_wh AS
SELECT id AS wh001_id FROM warehouses WHERE code = 'WH-001' LIMIT 1;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM _norm_wh) THEN
    RAISE EXCEPTION 'WH-001 warehouse not found';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- PHASE 4 (first): Location expansion — zone + aisle + bins for merged stock
-- ---------------------------------------------------------------------------
INSERT INTO _perf_norm_metrics (step, metric, value_num)
SELECT 'phase4', 'distinct_stock_keys', COUNT(*)::numeric
FROM (
  SELECT company_id, product_id, lot_id, package_id
  FROM current_stock
  GROUP BY company_id, product_id, lot_id, package_id
) k;

-- Parent: normalization zone (under WH-001 root)
INSERT INTO locations (
  id, warehouse_id, parent_id, name, full_path, type, barcode, sort_order, status, aisle
)
SELECT
  '00000000-0000-4000-8000-000000000030'::uuid,
  w.wh001_id,
  NULL,
  'Zone NORM',
  'WH-001/NORM',
  'warehouse'::location_type,
  'WH-001-NORM-ZONE',
  9000,
  'active'::location_status,
  'NORM'
FROM _norm_wh w
ON CONFLICT (id) DO NOTHING;

INSERT INTO locations (
  id, warehouse_id, parent_id, name, full_path, type, barcode, sort_order, status, aisle
)
SELECT
  '00000000-0000-4000-8000-000000000031'::uuid,
  w.wh001_id,
  '00000000-0000-4000-8000-000000000030'::uuid,
  'Aisle NORM-A',
  'WH-001/NORM/A',
  'iss'::location_type,
  'WH-001-NORM-A',
  9001,
  'active'::location_status,
  'NORM-A'
FROM _norm_wh w
ON CONFLICT (id) DO NOTHING;

-- Bins: one per distinct stock key (+ 5% headroom)
INSERT INTO locations (
  warehouse_id, parent_id, name, full_path, type, barcode, sort_order, status, aisle, rack, bin
)
SELECT
  w.wh001_id,
  '00000000-0000-4000-8000-000000000031'::uuid,
  'Bin ' || gs.n::text,
  'WH-001/NORM/A/' || lpad(gs.n::text, 5, '0'),
  'internal'::location_type,
  'WH-001-NORM-BIN-' || lpad(gs.n::text, 5, '0'),
  10000 + gs.n,
  'active'::location_status,
  'NORM-A',
  'R' || ((gs.n - 1) / 100 + 1)::text,
  lpad(((gs.n - 1) % 100 + 1)::text, 2, '0')
FROM _norm_wh w
CROSS JOIN generate_series(1, 11000) AS gs(n)
ON CONFLICT (barcode) DO NOTHING;

INSERT INTO _perf_norm_metrics (step, metric, value_num)
SELECT 'phase4', 'norm_bins_created', COUNT(*)::numeric
FROM locations
WHERE barcode LIKE 'WH-001-NORM-BIN-%';

-- Map each merged stock key to a bin (stable order)
CREATE TEMP TABLE _norm_loc_map AS
SELECT
  k.company_id,
  k.product_id,
  k.lot_id,
  k.package_id,
  l.id AS location_id
FROM (
  SELECT
    company_id,
    product_id,
    lot_id,
    package_id,
    row_number() OVER (ORDER BY company_id, product_id, lot_id NULLS FIRST, package_id NULLS FIRST) AS rn
  FROM current_stock
  GROUP BY company_id, product_id, lot_id, package_id
) k
JOIN locations l ON l.barcode = 'WH-001-NORM-BIN-' || lpad(k.rn::text, 5, '0');

-- ---------------------------------------------------------------------------
-- PHASE 3: Stock merge + move to WH-001
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE _norm_stock_merge AS
SELECT
  (array_agg(cs.id ORDER BY (cs.warehouse_id = w.wh001_id) DESC, cs.id))[1] AS survivor_id,
  cs.company_id,
  cs.product_id,
  cs.lot_id,
  cs.package_id,
  SUM(cs.quantity_on_hand) AS quantity_on_hand,
  SUM(cs.quantity_reserved) AS quantity_reserved,
  (array_agg(cs.status ORDER BY (cs.warehouse_id = w.wh001_id) DESC, cs.id))[1] AS status,
  MAX(cs.last_movement_at) AS last_movement_at,
  COUNT(*)::bigint AS slice_count
FROM current_stock cs
CROSS JOIN _norm_wh w
GROUP BY cs.company_id, cs.product_id, cs.lot_id, cs.package_id;

INSERT INTO _perf_norm_metrics (step, metric, value_num)
SELECT 'phase3', 'merge_groups', COUNT(*)::numeric FROM _norm_stock_merge
UNION ALL SELECT 'phase3', 'slices_merged_away', SUM(slice_count - 1) FROM _norm_stock_merge
UNION ALL SELECT 'phase3', 'duplicate_groups_multi_wh', COUNT(*)::numeric
FROM _norm_stock_merge WHERE slice_count > 1;

-- Delete non-survivor slices first (avoids unique index conflicts on update)
WITH doomed AS (
  SELECT cs.id
  FROM current_stock cs
  LEFT JOIN _norm_stock_merge m
    ON m.company_id = cs.company_id
   AND m.product_id = cs.product_id
   AND m.lot_id IS NOT DISTINCT FROM cs.lot_id
   AND m.package_id IS NOT DISTINCT FROM cs.package_id
  WHERE cs.id <> m.survivor_id
)
DELETE FROM current_stock cs USING doomed d WHERE cs.id = d.id;

INSERT INTO _perf_norm_metrics (step, metric, value_num)
SELECT 'phase3', 'rows_deleted', (SELECT value_num FROM _perf_norm_metrics WHERE step='pre' AND metric='stock_rows') - COUNT(*)::numeric
FROM current_stock;

-- Update survivors: quantities, warehouse, location
UPDATE current_stock cs
SET
  warehouse_id = w.wh001_id,
  location_id = lm.location_id,
  quantity_on_hand = m.quantity_on_hand,
  quantity_reserved = m.quantity_reserved,
  status = m.status,
  last_movement_at = m.last_movement_at,
  version = cs.version + 1
FROM _norm_stock_merge m
JOIN _norm_loc_map lm
  ON lm.company_id = m.company_id
 AND lm.product_id = m.product_id
 AND lm.lot_id IS NOT DISTINCT FROM m.lot_id
 AND lm.package_id IS NOT DISTINCT FROM m.package_id
CROSS JOIN _norm_wh w
WHERE cs.id = m.survivor_id;

INSERT INTO _perf_norm_metrics (step, metric, value_num)
SELECT 'post_stock', 'stock_rows', COUNT(*)::numeric FROM current_stock
UNION ALL SELECT 'post_stock', 'stock_qty_on_hand', SUM(quantity_on_hand) FROM current_stock
UNION ALL SELECT 'post_stock', 'stock_in_wh001', COUNT(*)::numeric FROM current_stock cs
  JOIN warehouses wh ON wh.id = cs.warehouse_id WHERE wh.code = 'WH-001'
UNION ALL SELECT 'post_stock', 'negative_qty_rows', COUNT(*)::numeric FROM current_stock WHERE quantity_on_hand < 0
UNION ALL SELECT 'post_stock', 'reserved_gt_on_hand', COUNT(*)::numeric FROM current_stock WHERE quantity_reserved > quantity_on_hand;

-- ---------------------------------------------------------------------------
-- PHASE 5: Workflow normalization
-- ---------------------------------------------------------------------------
INSERT INTO _perf_norm_metrics (step, metric, value_num)
SELECT 'phase5', 'workflow_instances_before_other_wh', COUNT(*)::numeric
FROM workflow_instances wi
CROSS JOIN _norm_wh w
WHERE wi.warehouse_id <> w.wh001_id;

UPDATE workflow_instances wi
SET warehouse_id = w.wh001_id, updated_at = now()
FROM _norm_wh w
WHERE wi.warehouse_id <> w.wh001_id;

UPDATE workers wk
SET warehouse_id = w.wh001_id, updated_at = now()
FROM _norm_wh w
WHERE wk.warehouse_id IS NOT NULL AND wk.warehouse_id <> w.wh001_id;

UPDATE stock_adjustments sa
SET warehouse_id = w.wh001_id, updated_at = now()
FROM _norm_wh w
WHERE sa.warehouse_id <> w.wh001_id;

INSERT INTO _perf_norm_metrics (step, metric, value_num)
SELECT 'post_workflow', 'tasks_in_wh001', COUNT(*)::numeric FROM warehouse_tasks wt
  JOIN workflow_instances wi ON wi.id = wt.workflow_instance_id
  JOIN warehouses wh ON wh.id = wi.warehouse_id WHERE wh.code = 'WH-001'
UNION ALL SELECT 'post_workflow', 'workflow_in_wh001', COUNT(*)::numeric FROM workflow_instances wi
  JOIN warehouses wh ON wh.id = wi.warehouse_id WHERE wh.code = 'WH-001';

-- ---------------------------------------------------------------------------
-- PHASE 6: Cleanup empty / test warehouses
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE _norm_wh_remove AS
SELECT w.id, w.code
FROM warehouses w
CROSS JOIN _norm_wh n
WHERE w.id <> n.wh001_id
  AND (
    w.code LIKE 'PERF-WH-%'
    OR w.code LIKE 'WHit-%'
    OR w.code LIKE 'WHoc-%'
    OR w.code = 'WH1'
    OR w.code = 'WH'
  );

INSERT INTO _perf_norm_metrics (step, metric, value_num)
SELECT 'phase6', 'warehouses_marked_remove', COUNT(*)::numeric FROM _norm_wh_remove;

-- Delete locations in removable warehouses (no stock should remain)
DELETE FROM locations l
USING _norm_wh_remove r
WHERE l.warehouse_id = r.id;

DELETE FROM warehouses w
USING _norm_wh_remove r
WHERE w.id = r.id;

INSERT INTO _perf_norm_metrics (step, metric, value_num)
SELECT 'post_cleanup', 'warehouses_remaining', COUNT(*)::numeric FROM warehouses
UNION ALL SELECT 'post_cleanup', 'locations_remaining', COUNT(*)::numeric FROM locations
UNION ALL SELECT 'post_cleanup', 'warehouses_removed', (SELECT value_num FROM _perf_norm_metrics WHERE step='phase6' AND metric='warehouses_marked_remove');

-- Final visibility
INSERT INTO _perf_norm_metrics (step, metric, value_num)
SELECT 'final', 'pct_stock_wh001',
  ROUND(100.0 * COUNT(*) FILTER (WHERE wh.code = 'WH-001') / NULLIF(COUNT(*), 0), 2)
FROM current_stock cs JOIN warehouses wh ON wh.id = cs.warehouse_id;

INSERT INTO _perf_norm_metrics (step, metric, value_num)
SELECT 'final', 'pct_tasks_wh001',
  ROUND(100.0 * COUNT(*) FILTER (WHERE wh.code = 'WH-001') / NULLIF(COUNT(*), 0), 2)
FROM warehouse_tasks wt
JOIN workflow_instances wi ON wi.id = wt.workflow_instance_id
JOIN warehouses wh ON wh.id = wi.warehouse_id;

INSERT INTO _perf_norm_metrics (step, metric, value_num)
SELECT 'final', 'pct_workflow_wh001',
  ROUND(100.0 * COUNT(*) FILTER (WHERE wh.code = 'WH-001') / NULLIF(COUNT(*), 0), 2)
FROM workflow_instances wi JOIN warehouses wh ON wh.id = wi.warehouse_id;

INSERT INTO _perf_norm_metrics (step, metric, value_num)
SELECT 'final', 'duplicate_stock_positions',
  COUNT(*)::numeric
FROM (
  SELECT company_id, product_id, location_id, lot_id
  FROM current_stock
  WHERE lot_id IS NOT NULL
  GROUP BY company_id, product_id, location_id, lot_id
  HAVING COUNT(*) > 1
) d;

SELECT step, metric, value_num, value_text FROM _perf_norm_metrics ORDER BY recorded_at, step, metric;
