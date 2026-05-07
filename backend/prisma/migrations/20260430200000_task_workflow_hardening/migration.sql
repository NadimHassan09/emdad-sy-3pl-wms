-- Additive enums and locations columns (task-driven workflow hardening)

ALTER TYPE warehouse_task_type ADD VALUE 'putaway_quarantine';
ALTER TYPE workflow_instance_status ADD VALUE 'degraded';
ALTER TYPE warehouse_task_status ADD VALUE 'retry_pending';

ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS aisle TEXT,
  ADD COLUMN IF NOT EXISTS rack TEXT,
  ADD COLUMN IF NOT EXISTS bin TEXT,
  ADD COLUMN IF NOT EXISTS coord_x DECIMAL(10, 3),
  ADD COLUMN IF NOT EXISTS coord_y DECIMAL(10, 3);
