# WORKFLOW-NORMALIZATION-REPORT.md

**Phase:** PERF-NORM-1 — Phase 5  
**Script:** `scripts/perf-norm-1-migrate.sql`  
**Database:** `wms_db_staging`

---

## Summary

| Entity | Before (WH-001 / other) | After |
|--------|-------------------------|-------|
| `workflow_instances` | ~530 / ~4,527 | **5,057 / 0** |
| `warehouse_tasks` | ~1,427 / ~8,573 | **10,000 / 0** |

**100%** of workflows and tasks now reference **WH-001**.

---

## Operations executed

| Table | Action | Rows affected |
|-------|--------|--------------:|
| `workflow_instances` | `UPDATE warehouse_id → WH-001` | **4,283** |
| `workers` | `UPDATE warehouse_id → WH-001` (non-null, non–WH-001) | **8** |
| `stock_adjustments` | `UPDATE warehouse_id → WH-001` | **0** |

---

## Preserved fields

The migration **only** changed `warehouse_id` (and `updated_at` where applicable) on `workflow_instances`, `workers`, and `stock_adjustments`.

**Not modified:**

- `warehouse_tasks.status`, assignments, timestamps, payload, `execution_state`  
- `task_assignments`, `task_events`  
- `workflow_nodes` status / sequence / metadata  
- Order records (`inbound_orders`, `outbound_orders`)

---

## Orphan orders (unchanged)

| Metric | Count |
|--------|------:|
| Inbound without workflow | 197 |
| Outbound without workflow | 4,756 |

These orders were **not** part of workflow/task warehouse scoping. They remain a **functional** gap, not a normalization failure for warehouse-scoped tasks.

---

## WH1 legacy warehouse

Pre-normalization **8,549** tasks were tied to `WH1` workflows. All **`workflow_instances.warehouse_id`** values are now **WH-001**; tasks follow via `workflow_instance_id`.

---

## Post-validation

```sql
-- Expected: 100% WH-001
SELECT w.code, COUNT(*)
FROM warehouse_tasks wt
JOIN workflow_instances wi ON wi.id = wt.workflow_instance_id
JOIN warehouses w ON w.id = wi.warehouse_id
GROUP BY w.code;
-- WH-001 | 10000
```
