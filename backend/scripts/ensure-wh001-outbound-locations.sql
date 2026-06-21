-- Ensure WH-001 has packing and shipping dock locations required by pick/pack/dispatch tasks.
-- Safe to re-run (skips when barcodes already exist).

BEGIN;

\set wh001_id '00000000-0000-4000-8000-000000000010'

INSERT INTO locations (
  id,
  warehouse_id,
  parent_id,
  name,
  full_path,
  type,
  barcode,
  sort_order,
  status,
  created_at,
  updated_at
)
SELECT
  '00000000-0000-4000-8000-000000000030'::uuid,
  :'wh001_id'::uuid,
  NULL,
  'Packing station',
  'WH-001/PACK-001',
  'packing'::location_type,
  'WH-001-PACK-001',
  30,
  'active'::location_status,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM locations WHERE barcode = 'WH-001-PACK-001'
);

INSERT INTO locations (
  id,
  warehouse_id,
  parent_id,
  name,
  full_path,
  type,
  barcode,
  sort_order,
  status,
  created_at,
  updated_at
)
SELECT
  '00000000-0000-4000-8000-000000000031'::uuid,
  :'wh001_id'::uuid,
  NULL,
  'Shipping dock',
  'WH-001/SHIP-001',
  'output'::location_type,
  'WH-001-SHIP-001',
  31,
  'active'::location_status,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM locations WHERE barcode = 'WH-001-SHIP-001'
);

COMMIT;
