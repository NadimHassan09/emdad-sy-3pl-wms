# PHASE-2.7.5 — Dispatch↔Pick Deterministic Binding

**Status:** Implemented (safe incremental stabilization patch)  
**Date:** 2026-05-27  
**Goal:** Eliminate ambiguity in `dispatch.complete()` caused by selecting the “latest completed pick sibling” when multiple completed pick tasks exist in the same workflow.

---

## 1) Binding strategy (minimal + deterministic)

### Problem being removed
`dispatch.complete()` previously determined the pick reservation snapshot to ship by loading:
- *the latest completed* `pick` task in the workflow (ordered by `completedAt: desc`)

This becomes unsafe when more than one completed pick task exists due to:
- remediation / fork flows
- recovery / reopen flows that re-create pick executions

In those cases, “latest completed pick sibling” is not a stable identifier for the reservation snapshot that the dispatch must ship.

### New rule
When a dispatch task is created, it is deterministically bound to a specific originating pick task via an explicit linkage:
- `warehouse_tasks.payload.pick_task_id` is set to the pick task id whose `executionState.reservations` dispatch must ship.

### Enqueue-time binding (source of truth)
In `WorkflowOrchestrationService.enqueueDispatchTaskIfNeeded(...)`:
- when the enqueue is triggered by a **pick completion**, the just-completed pick task id is passed through and stored as `pick_task_id`
- when the enqueue is not triggered with an explicit pick id (legacy paths), the code resolves the binding deterministically:
  - it finds completed `pick` tasks in the workflow that have **non-empty** `executionState.reservations`
  - if exactly one candidate exists, it binds to that pick
  - if multiple candidates exist, it refuses to enqueue and requires explicit binding (safety over ambiguity)

### Dispatch completion binding (no sibling ambiguity)
In `WarehouseTasksService.complete()` for `task_type === 'dispatch'`:
1. Parse dispatch task payload:
   - `outbound_order_id` (required)
   - `pick_task_id` (optional for legacy tasks)
2. Resolve the pick whose reservation snapshot must be shipped:
   - **if `pick_task_id` exists:** load that exact pick and validate:
     - it is in the same `workflowInstanceId`
     - it is a `pick` task
     - it is `completed`
     - it has `executionState.reservations.length > 0`
   - **if `pick_task_id` is missing:** do a deterministic safe fallback:
     - only allow dispatch completion when there is exactly one completed pick in the workflow with non-empty reservations
     - otherwise throw with a clear “ambiguous pick binding” error
3. Ship using the resolved pick’s `executionState.reservations`.
4. After successful ship, clear the referenced pick’s `executionState` to prevent stale snapshots from being re-released later.

### Files touched (key)
- `backend/src/modules/warehouse-workflow/workflow-orchestration.service.ts`
  - store `payload.pick_task_id` when enqueuing dispatch
  - deterministic pick binding when explicit pick id is not available
- `backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts`
  - replace ambiguous “latest completed pick” logic
  - bind dispatch shipment to the explicit (or uniquely-determined) pick snapshot
- `backend/src/integration-tests/sprint2/sprint2-reliability.integration.ts`
  - add coverage proving dispatch binds to the explicitly referenced pick even when it is not the latest completed sibling
- `backend/src/integration-tests/sprint2/reliability-test-helpers.ts`
  - dispatch fixtures now include `pick_task_id` by default

---

## 2) Lifecycle impact

### Dispatch completion (`dispatch.complete()`)
Before:
- dispatch shipped reservations from whichever completed pick appeared latest (by `completedAt`)
- this could be the wrong reservation snapshot under remediation/fork/recovery scenarios

After:
- dispatch ships reservations from the pick task snapshot referenced by `warehouse_tasks.payload.pick_task_id`
- if legacy dispatch tasks omit `pick_task_id`, completion is only allowed when the snapshot source is unambiguous

### Cancellation / failure cleanup
No workflow redesign and no reservation lifecycle changes were made.
The existing behavior remains:
- `dispatch.cancel`, `dispatch.fail`, and `resolveBlocked(..., cancel_remaining)` release pick reservations by scanning relevant picks in the workflow (not by dispatch→pick linkage).

This is intentional for minimal scope:
- the stabilization patch only replaces the ambiguous sibling lookup used during **shipping**.

---

## 3) Migration impact

### DB migration: none
No schema changes are required for this patch.
The linkage is stored in the existing JSON payload column:
- `warehouse_tasks.payload.pick_task_id`

### Live/legacy task compatibility
Some already-enqueued dispatch tasks may lack `pick_task_id`.

Compatibility behavior:
- If `pick_task_id` is missing:
  - completion is permitted only when there is exactly one completed pick in the workflow with non-empty reservation snapshots
  - otherwise completion throws to prevent shipping the wrong snapshot

Operationally, this means:
- safe tasks complete as before (unambiguous case)
- ambiguous legacy tasks fail loudly (instead of shipping from an incorrect pick snapshot)

---

## 4) Concurrency implications

What remains unchanged (and still important):
- `dispatch.complete()` already takes locks on:
  - workflow instance row
  - all pick tasks in the workflow (`lockWorkflowPickTasks`)
  - outbound order row

What changes:
- even though locks were already taken, the dispatch-side decision was based on non-deterministic “latest completed pick sibling”.
- now the decision is deterministic:
  - by explicit pick id when available
  - otherwise by “exactly one valid candidate” rule

Result:
- prevents cross-execution snapshot drift under concurrent/forked/recovered workflow states
- removes dependence on ordering by timestamps for correctness

---

## 5) Rollback safety analysis

Because this patch changes which pick reservation snapshot is selected during `dispatch.complete()`, rollback has correctness implications:

### If you roll back to the previous code
Previous code will resume selecting “latest completed pick sibling”.

That can reintroduce the original ambiguity in workflows where multiple completed picks exist and were retained across recovery/fork/remediation.

### Recommended rollback posture
- Treat rollback as *riskier* than forward deployment for correctness.
- If rollback is necessary, ensure that dispatch completion is only performed in workflows where the pick snapshot source remains unambiguous (or where legacy sibling ambiguity is known not to occur).

This patch is designed as a safety improvement; it intentionally prefers “fail closed” when ambiguity is detected.

---

## 6) Edge-case analysis

### Multiple completed picks, multiple reservation snapshots
Scenario:
- the workflow has >1 completed pick tasks with `executionState.reservations.length > 0`

New behavior:
- if `pick_task_id` is present on the dispatch task: dispatch binds to it and ships correct reservations
- if `pick_task_id` is absent:
  - dispatch completion throws an “ambiguous pick binding” error instead of selecting by timestamp

### Remediation / fork flows
Scenario:
- a remediation creates new pick executions while older completed picks remain present

New behavior:
- the dispatch is bound to the specific pick snapshot id that was created for the corresponding execution path
- dispatch no longer accidentally ships from the wrong historic sibling

### Reopen / retry flows
Scenario:
- dispatch is retried (or reopened) after earlier failures

New behavior:
- if dispatch is already completed, idempotency paths remain unchanged (no second ship)
- if dispatch is still in progress, dispatch re-resolves the bound pick snapshot from:
  - dispatch payload (`pick_task_id`), or
  - deterministic legacy fallback (unique candidate rule)

### Referenced pick missing/invalid
Scenario:
- dispatch payload references a non-existent pick task, a pick from a different workflow instance, or a non-completed pick

New behavior:
- dispatch completion fails immediately with a clear error
- this prevents shipping reservations from an incorrect snapshot source

---

## 7) Concurrency + correctness acceptance criteria (how to verify)

After deploying the patch:
- dispatch ships reservations from the pick task snapshot explicitly linked to it
- reopen/retry flows do not regress (dispatch idempotency and pick snapshot usage remain consistent)
- ambiguous multi-pick workflows fail closed when legacy payloads omit linkage
- no changes were made to reservation lifecycle / workflow DAG / task-graph design—only the ambiguous snapshot selection was replaced.

