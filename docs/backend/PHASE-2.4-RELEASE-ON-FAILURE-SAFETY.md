# Phase 2.4 — Release-on-Failure Safety

**Status:** Implemented (reservation cleanup on failure/cancel paths)  
**Date:** 2026-05-26  
**Scope (per Phase 2.4):**
- safe reservation release when pick fails, tasks cancel, outbound shipping aborts, retry aborts, or compensation recovery runs
- prevent locked phantom stock, stale reservation snapshots, and inventory deadlocks

**Non-goals:**
- no workflow redesign
- no inventory architecture redesign
- no dispatch/pick binding changes (Phase 2.1 items 6.2–6.3 remain separate)

---

## Problem

Pick reservations are created at `pick.start()` and stored in `warehouseTask.executionState.reservations`.  
They must be released when the outbound path is abandoned; otherwise `current_stock.quantity_reserved` stays inflated and available stock appears locked.

Phase 2.1 identified orphan reservations when:
- pick completed but dispatch never shipped
- `cancel_remaining` cancelled pending tasks but not completed pick snapshots
- compensation recovery released stock without clearing snapshots (risking double-release attempts)

---

## Implementation

### 1) Centralized release helpers

**File:** `backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts`

- `releaseTaskHeldReservations(tx, taskId, executionState)`
  - releases snapshot slices via `TaskInventoryEffectsService.releaseReservations`
  - clears `executionState` (`DbNull`) so the same task cannot double-release

- `releaseOutboundPickReservationsInWorkflow(tx, workflowInstanceId, opts?)`
  - scans all pick tasks in the workflow instance
  - releases and clears any task still holding reservation snapshots

- `releaseReservationsOnTaskCancel(tx, task)`
  - **pick cancel / retry abort:** releases reservations on the cancelled pick task
  - **dispatch cancel (outbound abandon):** releases reservations from all pick tasks in the workflow

### 2) Pick fail / execution error path

**Files:**
- `backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts` — new `fail()`
- `backend/src/modules/warehouse-workflow/warehouse-tasks.controller.ts` — `POST /tasks/:id/fail`

When a pick task transitions to `failed`, held reservations are released and `executionState` is cleared.

Supported transitions (existing state machine): `in_progress → failed`, `retry_pending → failed`.

### 3) Task cancel enhancements

**File:** `backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts` — `cancel()`

- pick / retry_pending pick cancel → release held reservations
- dispatch cancel on outbound workflow → release completed pick reservations (prevents orphan stock)

Cache invalidation uses `afterTaskAndStockMutation()` only when stock was actually released.

### 4) Workflow blocked resolution — `cancel_remaining`

**File:** `backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts` — `resolveBlocked()`

When resolution is `cancel_remaining` on an outbound workflow:
- pending/assigned sibling tasks are cancelled (unchanged)
- **all pick tasks** in the workflow instance have active reservation snapshots released and cleared

### 5) Successful dispatch clears stale pick snapshots

**File:** `backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts` — `complete()` dispatch branch

After `applyDispatchShip()` succeeds, the completed pick sibling’s `executionState` is cleared so a later cleanup path cannot attempt to re-release already-shipped reservations.

### 6) Idempotent release slices

**File:** `backend/src/modules/warehouse-workflow/task-inventory-effects.service.ts`

- extracted `mergeReservationSnapshots()` (shared by allocate + release)
- `releaseReservations()` merges duplicate slices before decrementing `quantity_reserved`

### 7) Compensation recovery hardening

**File:** `backend/src/modules/warehouse-workflow/workflow-recovery.service.ts`

- transaction loop re-validates `task.workflowInstanceId === instanceId` before release (matches preview scoping)
- clears `executionState` after successful `RELEASE_RESERVATIONS_OUTBOUND`

---

## Failure-path coverage matrix

| Trigger | Release behavior |
|--------|-------------------|
| Pick cancel | Release pick task snapshots |
| Pick fail (`POST /tasks/:id/fail`) | Release pick task snapshots |
| Retry abort (retry_pending → cancelled) | Release pick task snapshots |
| Dispatch cancel (outbound) | Release all pick snapshots in workflow |
| `resolveBlocked(cancel_remaining)` (outbound) | Release all pick snapshots in workflow |
| Pick restart (`start()` after reopen) | Release prior snapshots before re-allocate (Phase 2.2) |
| Dispatch ship success | Clear pick snapshots (already consumed in stock) |
| Compensation `RELEASE_RESERVATIONS_OUTBOUND` | Release + clear scoped task snapshots |

---

## Integrity outcomes

1. **No orphan reserved stock** when outbound shipping is abandoned before dispatch completes.
2. **No double-release attempts** — `executionState` is cleared atomically with release; dispatch success clears stale pick snapshots.
3. **No reservation deadlocks** — restarts and compensation paths cannot stack releases on phantom slices (merge + clear).
4. **Compensation scoping** — recovery cannot release reservations from tasks outside the target workflow instance.

---

## Files changed

- `backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts`
- `backend/src/modules/warehouse-workflow/warehouse-tasks.controller.ts`
- `backend/src/modules/warehouse-workflow/task-inventory-effects.service.ts`
- `backend/src/modules/warehouse-workflow/workflow-recovery.service.ts`

---

## Verification

- `npx tsc --noEmit` (backend) passes.
- No linter errors in modified files.
