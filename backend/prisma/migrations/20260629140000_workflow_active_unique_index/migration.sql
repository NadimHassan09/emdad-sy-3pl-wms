-- Phase 6.2 — at most one active workflow per operational order (reference_type + reference_id).
-- Active = pending | in_progress | degraded (terminal: completed | cancelled).

-- 1) Resolve any existing duplicate active rows before adding the partial unique index.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY reference_type, reference_id
      ORDER BY created_at DESC, id DESC
    ) AS rn
  FROM workflow_instances
  WHERE status IN ('pending', 'in_progress', 'degraded')
)
UPDATE workflow_instances AS wi
SET
  status = 'cancelled',
  updated_at = NOW()
FROM ranked AS r
WHERE wi.id = r.id
  AND r.rn > 1;

-- 2) Enforce invariant at the database layer (concurrent-safe with application row locks).
CREATE UNIQUE INDEX workflow_instances_one_active_per_reference_uidx
  ON workflow_instances (reference_type, reference_id)
  WHERE status IN ('pending', 'in_progress', 'degraded');
