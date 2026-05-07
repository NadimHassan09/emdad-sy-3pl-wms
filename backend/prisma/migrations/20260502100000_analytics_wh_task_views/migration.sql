-- Part III — read-optimized facts for warehouse_task analytics (dashboards / GET analytics/overview).
CREATE OR REPLACE VIEW v_analytics_wh_task_completed_rows AS
SELECT
  wt.id                                                         AS task_id,
  wi.company_id                                                 AS company_id,
  wi.warehouse_id                                               AS warehouse_id,
  wt.task_type::TEXT                                            AS task_type,
  wt.started_at                                                 AS started_at,
  wt.completed_at                                               AS completed_at,
  CASE
    WHEN wt.started_at IS NOT NULL AND wt.completed_at IS NOT NULL THEN
      EXTRACT(EPOCH FROM (wt.completed_at - wt.started_at)) / 60.0
    ELSE NULL
  END                                                           AS duration_minutes
FROM warehouse_tasks wt
INNER JOIN workflow_instances wi ON wi.id = wt.workflow_instance_id
WHERE wt.status = 'completed'::warehouse_task_status
  AND wt.completed_at IS NOT NULL;
