-- Warehouse task list: support ORDER BY updated_at DESC and worker-scoped filters.

CREATE INDEX IF NOT EXISTS idx_warehouse_tasks_updated_at_desc
  ON warehouse_tasks (updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_warehouse_tasks_status_updated_at_desc
  ON warehouse_tasks (status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_task_assignments_active_worker
  ON task_assignments (worker_id, task_id)
  WHERE unassigned_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_workflow_instances_wh_company
  ON workflow_instances (warehouse_id, company_id);
