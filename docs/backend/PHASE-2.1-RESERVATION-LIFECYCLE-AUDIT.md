# Phase 2.1 — Reservation Lifecycle Audit

**Date:** 2026-05-26  
**Scope (per Phase 2.1):**
1. Reservation creation
2. Reservation updates
3. Reservation release
4. Reservation completion
5. Retry safety

**Non-goals / explicitly out of scope:**
- No inventory architecture redesign
- No reservation subsystem redesign
- No workflow/engine redesign beyond identifying integrity gaps and recommending safe, incremental fixes
- No websocket architecture changes

---

## 1. Reservation lifecycle: what the code currently does

### 1.1 Reservation creation (Outbound “pick” allocation)

Pick reservations are created when a `warehouse_tasks` row of `taskType = 'pick'` is **started**.

**Entry point:**
- `WarehouseTasksService.start()` builds reservations and writes them into `warehouseTask.executionState`.

**Core allocation logic:**
- `TaskInventoryEffectsService.buildPickReservations(...)`
  - FEFO candidates are derived from `findWarehouseStockFefo(...)`
  - For each FEFO slice, the code calls:
    - `StockHelpers.incrementReservedWithMeta(...)`
  - The resulting slice list is stored as `executionState: { reservations: ReservationSnapshot[] }`.

**Evidence (key functions):**
- `backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts` — `start()` calls `effects.buildPickReservations(...)` and persists `executionState: { reservations }`
- `backend/src/modules/warehouse-workflow/task-inventory-effects.service.ts` — `buildPickReservations()`
- `backend/src/modules/inventory/stock.helpers.ts` — `incrementReservedWithMeta()`:
  - Computes `available = quantity_on_hand - quantity_reserved`
  - Uses `FOR UPDATE` and enforces `available >= qty` before updating `quantity_reserved += qty`

### 1.2 Reservation updates (while task is in progress)

During pick in-progress, the reservation slices are not “incrementally edited” in this phase:
- `executionState.reservations` is written once at pick `start()`
- subsequent task `patchProgress()` merges JSON into `executionState` but does not perform reservation mutation.

**Implication:** reserved inventory correctness depends on the initial reservation slice being stable until dispatch (or explicit release).

### 1.3 Reservation completion (Outbound “dispatch” shipping)

Reservations are *consumed* at outbound dispatch time:
- `WarehouseTasksService.complete()` for `task_type = 'dispatch'` loads the pick sibling’s `executionState.reservations`
- `TaskInventoryEffectsService.applyDispatchShip(...)` loops those reservation snapshots and calls:
  - `StockHelpers.decrementShippedWithMeta(...)`

`decrementShippedWithMeta(...)` is critical because it decrements both:
- `current_stock.quantity_on_hand`
- `current_stock.quantity_reserved`

with row-level constraints:
- `quantity_reserved >= shipped_qty`
- `quantity_on_hand - shipped_qty >= 0`

**Evidence:**
- `backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts` — dispatch completion loads `pickSibling` and `pickExec.reservations`
- `backend/src/modules/warehouse-workflow/task-inventory-effects.service.ts` — `applyDispatchShip(...)` calls `decrementShippedWithMeta`
- `backend/src/modules/inventory/stock.helpers.ts` — `decrementShippedWithMeta()` performs atomic updates to both on-hand and reserved.

### 1.4 Reservation release (explicit rollback / cancellation / compensation)

There are three explicit release mechanisms in this codebase:

1. **Pick task cancellation**
   - `WarehouseTasksService.cancel()` releases reservations only when:
     - `task.taskType === 'pick'`
     - `exec.reservations?.length > 0`

2. **Workflow recovery compensation**
   - `WorkflowRecoveryService.recoverWorkflowInstance(...)` supports an action:
     - `RELEASE_RESERVATIONS_OUTBOUND`
   - It calls `TaskInventoryEffectsService.releaseReservations(...)`.

3. **Manual cancellation of remaining tasks via “resolveBlocked”**
   - `WarehouseTasksService.resolveBlocked(...)` can cancel remaining pending/assigned tasks.
   - **However:** it does not release already-created reservations held by previously completed pick tasks (details below).

**Evidence:**
- `backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts` — `cancel()` releases reservations only for pick tasks
- `backend/src/modules/warehouse-workflow/workflow-recovery.service.ts` — compensation release reservations
- `backend/src/modules/warehouse-workflow/task-inventory-effects.service.ts` — `releaseReservations()` calls `StockHelpers.releaseReservedWithMeta(...)`
- `backend/src/modules/inventory/stock.helpers.ts` — `releaseReservedWithMeta()` decrements `quantity_reserved` only.

---

## 2. Expected invariants (what must always be true)

The reservation subsystem is safe only if these invariants hold:

1. **No double allocation:** every reserved unit must correspond to a unique pick allocation attempt that hasn’t already been released/shipped.
2. **No orphan reservations:** reserved stock must not remain indefinitely after the workflow path that will consume it is abandoned.
3. **Reservation-to-shipping correspondence:** dispatch must consume exactly the reservation slices that were allocated for that outbound shipment.
4. **Retry must not mutate allocations incorrectly:** retries must either:
   - re-use the same reservations safely, or
   - release old reservations before creating new ones.
5. **Compensation actions must be scoped:** compensation must only affect reservations belonging to the intended workflow instance and tenant.

---

## 3. Unsafe flows and integrity risks

### 3.1 Orphan reservations when dispatch is cancelled / never reached

**Problem pattern:**
- Pick reservations are created at `pick.start()`.
- Reservations are only released via:
  - pick cancellation (`cancel()` checks `task.taskType === 'pick'`), or
  - dispatch shipping (`decrementShippedWithMeta`), or
  - explicit workflow recovery compensation.

**Key state machine constraint:**
- `canTransitionTask()` forbids cancel from terminal states.
- A completed pick task is terminal (`completed`) and cannot be cancelled.

**Consequence:**
- If a workflow reaches:
  - `pick.completed` but then `dispatch` is cancelled, skipped, or never completes
  - then **pick reservations remain in `current_stock.quantity_reserved` indefinitely**.

This is especially likely when:
- `resolveBlocked(..., resolution='cancel_remaining')` cancels only **pending/assigned** tasks
- it does not “retroactively” cancel already completed pick tasks, so it cannot trigger reservation release.

**Evidence points:**
- `WarehouseTasksService.cancel()`:
  - releases reservations only if cancelling the pick task itself
- `WarehouseTasksService.resolveBlocked()`:
  - cancels remaining pending/assigned tasks but does not scan for completed pick tasks to release reservations
- `TaskInventoryEffectsService.releaseReservations()`:
  - releases `quantity_reserved` only (no automatic reconciliation to order state)

**Integrity impact:**
- `quantity_available` decreases because `available = on_hand - reserved`
- future allocations may fail due to “Insufficient stock to reserve”
- stock state becomes “logically stuck” until manual recovery.

### 3.2 Double allocations risk when re-starting pick after a failed attempt (reopen path)

**Problem pattern:**
- Pick reservations are stored in `warehouseTask.executionState.reservations`.
- `WarehouseTasksService.reopen()` transitions a task from `failed -> pending`.
- `reopen()` does **not** clear `executionState`.
- `start()` for pick **always** calls `buildPickReservations(...)` and overwrites `executionState` with a new reservations array.

**If** the previous reservation set was not released (there’s no automatic release on reopen in this code),
then the system can reserve stock **again** on top of existing reservations.

**Evidence points:**
- `WarehouseTasksService.reopen()`:
  - updates only `status` and `failureReason`, no `executionState` clearing / reservation release
- `WarehouseTasksService.start()`:
  - pick start builds reservations without releasing any pre-existing reservations found in execution state

**Integrity impact:**
- can lead to `Insufficient stock` later due to over-reservation
- can create mismatches between order-line picked quantities and actual shipped quantities (if retries later consume the wrong reservation set).

**Note:** This risk is most severe if failed tasks are used with non-cleared execution state (the code supports `failed` transitions but does not show where failures are set to `failed`).

### 3.3 Dispatch uses “latest completed pick” and does not bind to the correct reservation set

**Problem pattern:**
- In `WarehouseTasksService.complete()` for `task_type='dispatch'`, the code loads:
  - the *most recent* completed `pick` sibling in the workflow instance:
    - `findFirst(... taskType: 'pick', status:'completed', orderBy: completedAt desc)`

There is **no explicit link** between:
- this specific dispatch task, and
- the specific pick task whose reservations should be consumed.

**Consequence:**
- If multiple pick tasks exist for a workflow instance (or any historical/cached rows exist),
dispatch may consume reservations from the wrong pick.

**Additional missing validation:**
- `applyDispatchShip(...)` validates that each `body.lines` entry’s `ship_qty` equals `outboundOrderLine.pickedQuantity`.
- But it **does not validate completeness**:
  - it does not require that `body.lines` cover all `reservations` slices
  - and it does not ensure every reservation slice belongs to the `body.lines` set.

So if dispatch `body.lines` is incomplete, the code will still ship (decrement reserved) for *all* reservations loaded from the pick sibling.

**Evidence points:**
- Dispatch completion loads `pickSibling` by “latest completed pick”
- `TaskInventoryEffectsService.applyDispatchShip(...)` loops over all `reservations` snapshots and decrements for each
- No mapping validation between `body.lines` and reservation slices exists.

**Integrity impact:**
- inconsistent stock state transitions vs. order-line shipping intent
- could ship more quantity than the dispatch payload indicates
- could ship wrong lots/locations.

### 3.4 Workflow recovery compensation lacks “task belongs to instance” validation in the transaction

`WorkflowRecoveryService` performs an ownership check in the **preview** portion:
- it validates `task.workflowInstanceId === instanceId` when building preview effects.

But inside the **actual transaction** loop:
- it fetches `tx.warehouseTask.findUniqueOrThrow({ where: { id: action.task_id } })`
- it does **not** re-validate that the fetched `task.workflowInstanceId === instanceId`.

**Consequence:**
- a recovery action could release reservations from a task that does not belong to the target workflow instance,
as long as an operator can submit arbitrary `task_id` values within the same recovery request.

**Integrity impact:**
- tenant-scoped reserved stock can be released unexpectedly
- subsequent dispatch actions may fail due to insufficient reserved stock.

---

## 4. Concurrency risks

### 4.1 Concurrent reservation creation is largely protected

Pick reservation allocation is created inside:
- `WarehouseTasksService.start()` transaction
- which locks the task row (`SELECT ... FOR UPDATE` on `warehouse_tasks`)
- and each reservation update uses `StockHelpers.incrementReservedWithMeta()` which performs per-row `FOR UPDATE` and ensures availability before incrementing reserved.

**Net effect:**
- prevents two concurrent pick starts from over-allocating the same stock row
- reservation creation is “all-or-nothing” due to transaction rollback.

### 4.2 Idempotency protects ledger, not stock decrements (relies on task state)

For dispatch shipping:
- ledger rows are idempotent (`LedgerIdempotencyService.appendIfAbsent`)
- but stock decrement is not “ledger-idempotent”; it is enforced by row constraints:
  - `quantity_reserved >= qty` is required.

This is safe if—and only if—the task state machine prevents repeated dispatch completion:
- second completion should fail because task is no longer in `in_progress`.

If task state machine is ever bypassed (manual DB edits, race bugs, or inconsistent status transitions),
stock decrements could become “fail-fast” (insufficient stock) rather than double-decrement, but would still break workflow integrity.

---

## 5. Retry safety audit

### 5.1 Retry re-uses executionState reservations (good) but can still be unsafe if executionState is stale/missing

`WarehouseTasksService.retry()` transitions:
- `retry_pending -> in_progress`

without altering `executionState`.

For pick tasks, this means:
- reservations stay as previously allocated
- no double allocation occurs *as long as* the previous reservations remain reserved and consistent.

However, this becomes unsafe if:
- executionState was cleared by some other path,
- or if reservations were partially invalidated (e.g. via incorrect compensation),
- or if a pick retry path transitions through `reopen()` (see 3.2) and re-starts pick reservations without releasing old ones.

### 5.2 Dispatch retry safety is state-dependent and may ship wrong reservations

Dispatch completion loads reservations from “latest completed pick sibling”.

On retry:
- the code does not rebind to a specific correct reservation set
- it reuses whatever pick sibling is most recent.

If pick tasks were created/failed/reopened, the “latest pick” heuristic may drift.

---

## 6. Recommended fixes (incremental, no redesign)

### 6.1 Prevent orphan reservations on workflow/task cancellation

Add a reconciliation step when a workflow is abandoned before shipping:
- When cancelling a `dispatch` task (or when cancelling remaining workflow tasks),
  scan for completed `pick` tasks that belong to the same workflow instance
  and release their `executionState.reservations`.

This is not a redesign: it reuses `TaskInventoryEffectsService.releaseReservations(...)`.

Where to implement (candidates):
- `WarehouseTasksService.cancel()`:
  - on cancelling `dispatch` (or on certain workflow references), release reservations from completed pick tasks
- `WarehouseTasksService.resolveBlocked()`:
  - in `cancel_remaining` path, release reservations from completed pick tasks for that workflow instance.

### 6.2 Bind dispatch shipping to the correct pick reservation set

Replace the “latest completed pick” selection with a deterministic link:
- Store `pick_task_id` (or a `reservation_set_id`) inside dispatch task payload or executionState when enqueueing the dispatch task.

Then load reservations by that exact pick task id.

If modifying task payload is too invasive:
- at minimum, validate that the selected pick task contains reservations for the outbound lines referenced in dispatch `body.lines`, and reject otherwise.

### 6.3 Validate dispatch completeness against reservations

In `TaskInventoryEffectsService.applyDispatchShip(...)`:
- compute the reservation set grouped by `outboundOrderLineId`
- ensure `body.lines`:
  - contains all outbound lines represented in reservations
  - and quantities match pickedQuantity for each reserved line.

Then only decrement shipped stock for reservations that belong to the lines present in the body (or hard-reject incomplete bodies).

This prevents “ship-all reservations even if body lists fewer lines”.

### 6.4 Release old reservations when re-starting pick after reopen

In `WarehouseTasksService.reopen()` and/or pick `start()`:
- if `task.taskType==='pick'` and `executionState.reservations` exists,
  release reservations before building new ones.

Alternatively:
- clear executionState during reopen (and ensure the task is returned to pending without reserved stock).

### 6.5 Fix recovery compensation scoping inside the transaction

In `WorkflowRecoveryService.recoverWorkflowInstance(...)`:
- inside the transaction loop, re-validate:
  - `task.workflowInstanceId === instanceId`
  before calling `effects.releaseReservations(...)`.

This makes preview and execution consistent and prevents accidental cross-task release.

### 6.6 Optional observability improvements (ledger parity)

Currently reservation allocation and release adjust `current_stock.quantity_reserved` but do not write inventory ledger rows.

For auditability and easier debugging:
- consider ledger audit rows for reservation allocation/release (Phase 2.2 or later),
or add structured task events containing reservation slices for postmortem analysis.

---

## 7. Summary of the highest-risk issues

1. **Orphan reservations** when dispatch never happens but pick reservations were already allocated (cancel/blocked/cancel_remaining paths).
2. **Double allocation potential** if pick tasks are re-started from reopened failed states without releasing previous reservations.
3. **Dispatch consumes wrong reservation set** due to “latest completed pick” heuristic and missing completeness validation between `body.lines` and reservation slices.
4. **Compensation scoping gap** in recovery transaction loop (preview validates, execution does not re-check task instance ownership).

---

## 8. Appendix: key code landmarks (for quick navigation)

- Pick reservation creation:
  - `backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts` — `start()` → `buildPickReservations`
  - `backend/src/modules/warehouse-workflow/task-inventory-effects.service.ts` — `buildPickReservations()`
  - `backend/src/modules/inventory/stock.helpers.ts` — `incrementReservedWithMeta()`

- Pick reservation release:
  - `backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts` — `cancel()` releases when cancelling pick
  - `backend/src/modules/warehouse-workflow/task-inventory-effects.service.ts` — `releaseReservations()`
  - `backend/src/modules/inventory/stock.helpers.ts` — `releaseReservedWithMeta()`

- Pick reservation completion (shipping consumption):
  - `backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts` — dispatch completion loads pick reservations
  - `backend/src/modules/warehouse-workflow/task-inventory-effects.service.ts` — `applyDispatchShip()`
  - `backend/src/modules/inventory/stock.helpers.ts` — `decrementShippedWithMeta()`

- Compensation recovery:
  - `backend/src/modules/warehouse-workflow/workflow-recovery.service.ts`
  - `backend/src/modules/warehouse-workflow/task-inventory-effects.service.ts` — `releaseReservations()`

- Dispatch spawning:
  - `backend/src/modules/warehouse-workflow/workflow-orchestration.service.ts` — `afterOutboundTask()` and `enqueueDispatchTaskIfNeeded()`

