# Phase 2.5 — Concurrent Pick Protection

**Status:** Implemented (inventory concurrency integrity)  
**Date:** 2026-05-26  
**Scope (per Phase 2.5):**
- transactional safety for pick reservation / completion / dispatch ship
- concurrency guards and row-lock strategy
- race-condition protection against double picking and inconsistent reservation state

**Non-goals:**
- no workflow redesign
- no dispatch↔pick binding changes (Phase 2.1 §6.2)
- no inventory schema changes

---

## Problem

Concurrent pick operations can race on the same `current_stock` rows:
- two pick tasks reserving overlapping FEFO slices
- two clients completing the same pick or dispatch
- dispatch shipping while another transaction mutates order lines or reservations

Without consistent locking, the system risks deadlocks, double stock deduction, or inconsistent `quantity_reserved` vs `executionState` snapshots.

---

## Implementation

### 1) Stable stock-row lock ordering

**File:** `backend/src/modules/warehouse-workflow/pick-concurrency.util.ts`

- `stockTupleLockKey()` — canonical key for `(companyId, productId, locationId, lotId)`
- `sortReservationSnapshotsForLocking()` — global sort before reserve / release / ship
- `sortPickLinesForLocking()` — deterministic product/line order when planning FEFO slices

**File:** `backend/src/modules/warehouse-workflow/task-inventory-effects.service.ts`

- `buildPickReservations()`:
  1. plan FEFO slices (read candidates)
  2. merge duplicate tuples
  3. **sort** slices, then call `incrementReservedWithMeta()` in that order
- `releaseReservations()` — merge + sort before decrementing reserved qty
- `applyDispatchShip()` — sort reservation slices before `decrementShippedWithMeta()`

**Integrity outcome:** concurrent picks lock `current_stock` rows in the same order → avoids cyclic deadlocks.

---

### 2) Workflow / outbound serialization on pick start

**File:** `backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts`

On `pick` `start()`:
- `lockWorkflowInstance()` — `SELECT … FROM workflow_instances FOR UPDATE`
- `lockWorkflowPickTasks()` — locks **all** pick rows in the workflow
- `assertExclusiveActivePickInWorkflow()` — rejects if another pick is already `in_progress`
- `lockOutboundOrder()` — `SELECT … FROM outbound_orders FOR UPDATE` before reservation

**Integrity outcome:**
- only one active pick reservation window per workflow
- outbound order lines cannot race with a concurrent confirm/cancel on the same order row set

---

### 3) Pick / dispatch completion guards

**Pick `complete()`:**
- locks workflow instance + all pick tasks before `applyPickRecord()`
- `applyPickRecord()` locks the outbound order row (double guard with service-level lock)

**Dispatch `complete()`:**
- locks workflow instance, pick tasks, and outbound order before shipping
- reservation decrements run in sorted stock-tuple order
- **idempotent** when dispatch task is already `completed` (prevents duplicate ship / double deduction on replay)

Existing pick idempotency (Phase 2.3) is unchanged.

---

### 4) Existing row-level stock constraints (unchanged, relied upon)

**File:** `backend/src/modules/inventory/stock.helpers.ts`

- `incrementReservedWithMeta()` — `FOR UPDATE` + `quantity_on_hand - quantity_reserved >= qty`
- `releaseReservedWithMeta()` — `FOR UPDATE` + `quantity_reserved >= qty`
- `decrementShippedWithMeta()` — `FOR UPDATE` + ships only when reserved and on-hand constraints pass
- `WarehouseTasksService.bumpStatus()` — optimistic `lockVersion` on task rows

Together with Phase 2.5 ordering, failed races fail fast (insufficient stock / conflict) inside a single DB transaction rollback.

---

## Concurrency coverage matrix

| Operation | Protection |
|-----------|------------|
| Concurrent `pick.start()` (same workflow) | Pick-task row locks + exclusive in_progress guard |
| Concurrent `pick.start()` (overlapping stock) | Sorted `current_stock` row locks |
| Concurrent `pick.complete()` | Task row lock + outbound order `FOR UPDATE` + idempotent replay |
| Concurrent `dispatch.complete()` | Task row lock + workflow/outbound locks + sorted ship + idempotent replay |
| Reservation release (cancel/fail) | Sorted release order (Phase 2.4 + 2.5) |

---

## Files changed

- `backend/src/modules/warehouse-workflow/pick-concurrency.util.ts` (new)
- `backend/src/modules/warehouse-workflow/task-inventory-effects.service.ts`
- `backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts`
- `backend/src/modules/inventory/stock.helpers.ts` (documentation note)

---

## Verification

- `npx tsc --noEmit` (backend) passes.
- No linter errors in modified files.
