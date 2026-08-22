-- PERF-NORM-1 cleanup (safe): remove empty warehouses/locations not referenced by inventory_ledger
\set ON_ERROR_STOP on

SELECT set_config('app.user_role', 'super_admin', true);

CREATE TEMP TABLE _norm_wh AS
SELECT id AS wh001_id FROM warehouses WHERE code = 'WH-001' LIMIT 1;

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

CREATE TEMP TABLE _ledger_location_ids AS
SELECT DISTINCT loc_id FROM (
  SELECT from_location_id AS loc_id FROM inventory_ledger WHERE from_location_id IS NOT NULL
  UNION
  SELECT to_location_id FROM inventory_ledger WHERE to_location_id IS NOT NULL
) x;

-- Deletable locations: in removable warehouses, not in ledger, not holding stock
CREATE TEMP TABLE _loc_delete AS
SELECT l.id
FROM locations l
JOIN _norm_wh_remove r ON r.id = l.warehouse_id
LEFT JOIN _ledger_location_ids led ON led.loc_id = l.id
LEFT JOIN current_stock cs ON cs.location_id = l.id
WHERE led.loc_id IS NULL AND cs.id IS NULL;

DELETE FROM locations l USING _loc_delete d WHERE l.id = d.id;

-- Mark warehouses that still have locations (ledger history) as inactive
UPDATE warehouses w
SET status = 'inactive', updated_at = now()
FROM _norm_wh_remove r
WHERE w.id = r.id
  AND EXISTS (SELECT 1 FROM locations l WHERE l.warehouse_id = w.id);

-- Delete warehouses with zero locations
DELETE FROM warehouses w
USING _norm_wh_remove r
WHERE w.id = r.id
  AND NOT EXISTS (SELECT 1 FROM locations l WHERE l.warehouse_id = w.id);

SELECT 'locations_deleted' AS metric, COUNT(*)::text AS value FROM _loc_delete
UNION ALL
SELECT 'warehouses_inactive', COUNT(*)::text FROM warehouses w JOIN _norm_wh_remove r ON r.id=w.id WHERE w.status='inactive'
UNION ALL
SELECT 'warehouses_deleted', COUNT(*)::text FROM _norm_wh_remove r
  WHERE NOT EXISTS (SELECT 1 FROM warehouses w WHERE w.id = r.id)
UNION ALL
SELECT 'warehouses_remaining', COUNT(*)::text FROM warehouses;
