-- Part III worker skills / required skills per plan GAP3
CREATE TABLE worker_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  skill_code TEXT NOT NULL,
  proficiency SMALLINT NOT NULL DEFAULT 1 CHECK (proficiency BETWEEN 1 AND 5),
  certified_until TIMESTAMPTZ(6),
  CONSTRAINT uq_worker_skill UNIQUE (worker_id, skill_code)
);

CREATE INDEX idx_worker_skills_worker ON worker_skills(worker_id);

CREATE TABLE warehouse_task_required_skills (
  task_id UUID NOT NULL REFERENCES warehouse_tasks(id) ON DELETE CASCADE,
  skill_code TEXT NOT NULL,
  minimum_proficiency SMALLINT NOT NULL DEFAULT 1,
  CONSTRAINT pk_wh_task_skill PRIMARY KEY (task_id, skill_code)
);

-- Part III GAP4 — SLA escalation columns on tasks
ALTER TABLE warehouse_tasks ADD COLUMN sla_minutes INT;
ALTER TABLE warehouse_tasks ADD COLUMN escalation_level SMALLINT NOT NULL DEFAULT 0;

-- Part IV.K merged workflow UX overrides (effective resolution in API layer)
ALTER TABLE companies ADD COLUMN workflow_ux_settings JSONB;
ALTER TABLE warehouses ADD COLUMN workflow_ux_settings JSONB;

-- Optional load view — security invoker; app uses company filter separately
CREATE OR REPLACE VIEW v_wms_worker_load AS
SELECT
  w.id AS worker_id,
  w.display_name AS full_name,
  COUNT(DISTINCT CASE WHEN wt.status = 'in_progress' THEN wt.id END)::INT AS in_progress_count,
  COUNT(DISTINCT CASE WHEN wt.status = 'assigned' THEN wt.id END)::INT AS assigned_pending_count,
  (
    COUNT(DISTINCT CASE WHEN wt.status = 'in_progress' THEN wt.id END) * 3
    + COUNT(DISTINCT CASE WHEN wt.status = 'assigned' THEN wt.id END)
  )::INT AS load_score
FROM workers w
LEFT JOIN task_assignments ta ON ta.worker_id = w.id AND ta.unassigned_at IS NULL
LEFT JOIN warehouse_tasks wt ON wt.id = ta.task_id AND wt.status IN ('assigned', 'in_progress')
GROUP BY w.id, w.display_name;
