# Warehouse Task List — Performance Optimization

## Summary

Replaced the frontend **500-row chunked load** with **server-side pagination** (25/50/100 per page) and a **lean list API response** that omits heavy JSON fields and optional runnability computation.

## API contract (`GET /api/tasks`)

| Query param | Type | Default | Description |
|-------------|------|---------|-------------|
| `limit` | int | **50** | Page size (1–2000). UI uses 25. |
| `offset` | int | 0 | Zero-based offset for pagination |
| `status` | string | — | Filter by task status |
| `taskType` | string | — | Filter by task type |
| `warehouseId` | uuid | — | Filter by warehouse |
| `workerId` | uuid | — | Admin filter: tasks assigned to worker |
| `referenceId` | uuid | — | Filter by workflow reference id |
| `updatedFrom` / `updatedTo` | ISO date | — | Updated-at range |
| `includeRunnability` | `true`/`false`/`1`/`0` | **false** | When true, adds `is_current_runnable`, `runnability_blocked_reason`, and `requiredSkills` (reports) |

### Response shape

```json
{
  "items": [
    {
      "id": "uuid",
      "taskType": "pick",
      "status": "pending",
      "updatedAt": "2026-06-11T12:00:00.000Z",
      "workflowInstance": {
        "id": "uuid",
        "companyId": "uuid",
        "referenceType": "outbound_order",
        "referenceId": "uuid",
        "warehouseId": "uuid"
      },
      "assignments": [
        {
          "workerId": "uuid",
          "unassignedAt": null,
          "worker": { "id": "uuid", "displayName": "…", "user": { "fullName": "…", "email": "…" } }
        }
      ]
    }
  ],
  "total": 1234,
  "limit": 25,
  "offset": 0
}
```

**Excluded from list rows (detail endpoint only):** `payload`, `executionState`, `requiredSkills` (unless `includeRunnability=true`).

### Worker-scoped views

`wh_operator` users always see only tasks assigned to their linked worker profile, regardless of `workerId` query param.

## Database indexes

Migration `20260612140000_warehouse_tasks_list_perf`:

- `idx_warehouse_tasks_updated_at_desc` — list sort
- `idx_warehouse_tasks_status_updated_at_desc` — filtered list sort
- `idx_task_assignments_active_worker` — partial index on active assignments
- `idx_workflow_instances_wh_company` — tenant/warehouse scoping

## Frontend

- `TasksListPage` uses `useServerPagination` (default page size **25**).
- Realtime cache patches `['tasks', 'list']` query keys.
- Reports pass `includeRunnability: 'true'`.

## Benchmark

Run against a running API:

```bash
node scripts/benchmark-tasks-list.mjs
```

Output: `docs/perf/tasks-list-benchmark.json`

### Measured results (staging API, 194 tasks)

| Scenario | Payload | Latency (avg) | Under 100 KB |
|----------|---------|---------------|--------------|
| Before: `limit=500` (legacy UI) | **344.4 KB** | 65.3 ms | No |
| After: `limit=25` (paginated UI) | **43.4 KB** | 14.8 ms | Yes |
| After: `limit=50` | 88.7 KB | 16.7 ms | Yes |
| After: `status=in_progress&limit=25` | 41.7 KB | 12.2 ms | Yes |

**Payload reduction:** 87.4% (344.4 KB → 43.4 KB). Additional lean-select savings (~19% per row) apply once the new backend is deployed.

| Scenario | Typical target |
|----------|----------------|
| Legacy `limit=500` | Large payload (baseline) |
| Optimized `limit=25` lean | **< 100 KB** initial load |
| `includeRunnability=true` | Heavier; used by reports only |

## Tests

```bash
cd backend && npm run test:unit -- warehouse-tasks-list.service.unit.spec.ts
```
