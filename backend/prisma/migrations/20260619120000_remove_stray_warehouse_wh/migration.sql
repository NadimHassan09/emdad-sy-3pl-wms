-- Remove erroneous warehouse with code WH (not WH-001). Reassign dependents to Main Warehouse when present.
DO $$
DECLARE
  stray_id uuid;
  main_id uuid;
BEGIN
  SELECT id INTO stray_id FROM warehouses WHERE code = 'WH' LIMIT 1;
  IF stray_id IS NULL THEN
    RETURN;
  END IF;

  SELECT id INTO main_id FROM warehouses WHERE code = 'WH-001' LIMIT 1;

  IF main_id IS NOT NULL THEN
    UPDATE workers SET warehouse_id = main_id WHERE warehouse_id = stray_id;
    UPDATE workflow_instances SET warehouse_id = main_id WHERE warehouse_id = stray_id;
    UPDATE stock_adjustments SET warehouse_id = main_id WHERE warehouse_id = stray_id;
    UPDATE current_stock cs
       SET warehouse_id = main_id
     WHERE cs.warehouse_id = stray_id;
  END IF;

  DELETE FROM locations WHERE warehouse_id = stray_id;
  DELETE FROM warehouses WHERE id = stray_id;
END $$;
