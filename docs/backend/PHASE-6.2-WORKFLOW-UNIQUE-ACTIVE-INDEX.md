# Phase 6.2 — Workflow Unique Active Index

**Status:** Implemented  
**Date:** 2026-05-29  
**Scope:** Database and application enforcement that at most one **active** workflow instance exists per operational order reference.

---

## Summary

| Layer | Mechanism |
|-------|-----------|
| Database | Partial unique index on `(reference_type, reference_id)` where status is active |
| Pre-migration | Duplicate active rows cancelled (newest kept) |
| Application | Reference order `FOR UPDATE` + active lookup + `P2002` replay |
| Shared constants | `WORKFLOW_ACTIVE_STATUSES` in `workflow-active.util.ts` |

---

## Indexes Added

| Index | Type | Columns | Predicate |
|-------|------|---------|-----------|
| `workflow_instances_one_active_per_reference_uidx` | **UNIQUE** (partial) | `reference_type`, `reference_id` | `status IN ('pending', 'in_progress', 'degraded')` |

**Migration:** `backend/prisma/migrations/20260629140000_workflow_active_unique_index/migration.sql`

Existing non-unique index `workflow_instances_reference_idx` on `(reference_type, reference_id)` is unchanged (supports historical / completed lookups).

---

## Invariants Enforced

1. **At most one active workflow** per `(reference_type, reference_id)` pair.
2. **Active statuses:** `pending`, `in_progress`, `degraded`.
3. **Terminal statuses** (`completed`, `cancelled`) are excluded from uniqueness — a new workflow may start after the previous one completes or is cancelled.
4. **Reference types:** `inbound_order`, `outbound_order` (both covered by the same index).

Violating insert/update → PostgreSQL unique violation → Prisma `P2002` → HTTP `409 UNIQUE_VIOLATION` if not caught in the engine.

---

## Concurrency Protections

### Database

Partial unique index makes duplicate active inserts **impossible**, even under parallel transactions.

### Application (`workflow-engine.service.ts`)

Bootstrap path for inbound and outbound:

```
BEGIN TRANSACTION
  lockWorkflowReferenceOrder()     -- FOR UPDATE on inbound_orders / outbound_orders
  findActiveWorkflowForReference() -- fast path idempotent return
  try workflowInstance.create + first task/node
  on P2002 (active unique index):
    findActiveWorkflowForReference() → loadWorkflowBootstrapBundle()
COMMIT
```

**Helpers:** `backend/src/modules/warehouse-workflow/workflow-active.util.ts`

| Function | Role |
|----------|------|
| `lockWorkflowReferenceOrder` | Serializes bootstrap per operational order |
| `findActiveWorkflowForReference` | Active workflow lookup |
| `loadWorkflowBootstrapBundle` | Idempotent return shape (instance + nodes + tasks) |
| `isActiveWorkflowUniqueViolation` | Detects partial-index `P2002` for replay |

**Read API alignment:** `getWorkflowInstanceGraphByReference` uses `WORKFLOW_ACTIVE_STATUSES` for consistency.

### Interaction with Phase 6.1

Outbound confirm already uses outbound row locks and CAS before calling `startOutboundWorkflowTx`. Phase 6.2 adds a **hard DB floor** if two bootstrap paths race past application checks.

---

## Migration Considerations

### Pre-flight deduplication

Before `CREATE UNIQUE INDEX`, the migration runs:

```sql
-- Keep newest active row per reference; cancel older duplicates
ROW_NUMBER() OVER (PARTITION BY reference_type, reference_id ORDER BY created_at DESC, id DESC)
→ status = 'cancelled' where rn > 1
```

**Operational note:** Cancelled duplicates retain their tasks/nodes for audit; they are no longer “active” and do not block new workflows.

### Deploy

```bash
cd backend
npx prisma migrate deploy
```

### Fresh vs existing databases

- **Fresh install:** Migration runs in order; no duplicates expected.
- **Existing DB with duplicates:** Dedup step runs automatically; then index is created.
- **No duplicates:** Dedup is a no-op; index creation succeeds immediately.

### Prisma schema

Partial unique indexes are not expressible in `schema.prisma`; documented via comment on `WorkflowInstance` pointing to migration `20260629140000`.

---

## Rollback Safety

### Roll back application only

Revert code to previous engine logic. **Index remains** — duplicate active workflows still blocked at DB (safe).

### Roll back database

```sql
DROP INDEX IF EXISTS workflow_instances_one_active_per_reference_uidx;
```

**Not reversible for data:** Rows cancelled during dedup are **not** auto-restored to active. Restore from backup if a mistaken deploy cancelled production workflows.

**Re-apply:** Re-run migration SQL (dedup + `CREATE UNIQUE INDEX`).

---

## Validation / Testing

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | Pass |
| `npm run test:integration:sprint2` | Pass (includes `concurrent workflow bootstrap`) |

**New test:** Parallel `createOutboundInstanceWithFirstPickTask` on the same picking order → one active workflow, one pick task.

**Existing coverage:** Phase 6.1 `concurrent outbound confirm (task flow)` also asserts a single workflow after parallel confirm.

---

## Files Changed

| File | Change |
|------|--------|
| `prisma/migrations/20260629140000_workflow_active_unique_index/migration.sql` | Dedup + partial unique index |
| `prisma/schema.prisma` | Comment documenting index |
| `workflow-active.util.ts` | **New** — constants, locks, replay helpers |
| `workflow-engine.service.ts` | Locks, shared lookup, `P2002` replay |
| `workflow-bootstrap.service.ts` | `WORKFLOW_ACTIVE_STATUSES` on reference graph lookup |
| `sprint2-reliability.integration.ts` | Concurrent bootstrap test |

---

## Related

- `docs/backend/PHASE-6.1-OUTBOUND-CONFIRM-RACE-PROTECTION.md` — confirm path serialization
- `docs/backend/SCOPE-ALIGNED-PRODUCTION-AUDIT.md` — C2 active workflow uniqueness
- `docs/backend/ENTERPRISE-WMS-COMPLETE-AUDIT-AND-TEST-ANALYSIS.md` — C2
