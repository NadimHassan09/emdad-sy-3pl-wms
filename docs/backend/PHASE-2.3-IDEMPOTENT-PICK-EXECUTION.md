# Phase 2.3 — Idempotent Pick Execution

**Status:** Implemented (backend execution safety)  
**Date:** 2026-05-26  
**Scope (per Phase 2.3):**
- picking execution idempotency
- safe handling of retries / duplicate requests / refresh / reconnect / websocket replay

**Non-goals:**
- no picking UI redesign
- no workflow redesign
- no inventory architecture redesign

---

## Problem

Duplicate `POST /tasks/:id/complete` requests for `task_type='pick'` can occur due to:
- retries on lost responses
- refresh/reconnect
- websocket replay events

Without idempotency, the backend would respond with an error on subsequent attempts after the task transitions away from `in_progress`, potentially confusing clients and potentially repeating execution side effects in other flows.

---

## Implementation

### Location
- `backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts`

### Change: pick completion becomes idempotent when already completed

In `WarehouseTasksService.complete()`:
- it still requires `task.status === in_progress` to run the pick completion side effects
- but if the task is already `completed` and:
  - `task.taskType === 'pick'`
  - `body.task_type === 'pick'`

then the second request becomes a **no-op**:
- no inventory/order side effects are re-run
- no notifications are emitted
- no cache invalidation / realtime completion signal is re-emitted
- the endpoint returns the current task envelope (`loadTaskEnvelope(...)`)

---

## Integrity impact

For pick tasks specifically:
- prevents duplicate pick completion side effects (order-line pickedQuantity update + completed events)
- avoids repeated orchestration hooks and repeated realtime/notification signals

For dispatch stock deduction:
- unchanged in Phase 2.3 (dispatch already guarded by task state)
- this phase does not alter reservation consumption logic

---

## Remaining risks (intentionally not addressed here)

This phase focuses on idempotency of **pick** completion requests. Other workflow actions (e.g. dispatch completion) can be handled in separate follow-ups if replay patterns affect those too.

---

## Verification

- `npx tsc --noEmit` (backend) passes.

