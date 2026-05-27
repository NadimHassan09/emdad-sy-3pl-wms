# Sprint 2 — Reliability & Integrity Audit

**Audit type:** Static code analysis + transactional path review (no architecture redesign)  
**Date:** 2026-05-26  
**Auditor role:** Backend QA / distributed-systems reliability review  
**Codebase state:** Post Sprint 2 (Phases 1.1–1.4, 2.1–2.6)  
**Automated test coverage:** **None** in `backend/src` (0 `*.spec.ts` / e2e files found)

---

# Executive Summary

Sprint 2 materially improved inventory and workflow reliability. The implementation uses **PostgreSQL row locks (`FOR UPDATE`)**, **optimistic task `lockVersion`**, **transaction-scoped stock mutations**, **pick/dispatch idempotent completion**, **sorted reservation lock ordering**, and **post-mutation stock invariant checks**. Release-on-failure paths and a **consistency validation API** address the highest-risk orphan-reservation scenarios identified in Phase 2.1.

This audit did **not** execute a live load test or integration suite (none exists in-repo). Findings are **evidence-based** from service code, SQL helpers, state-machine transitions, and Phase 2 documentation cross-checks.

| Dimension | Score (0–100) | Assessment |
|-----------|---------------|------------|
| Inventory integrity | **82** | Strong row-level constraints + release paths; known dispatch/pick binding gap remains |
| Concurrency safety | **84** | Solid lock strategy; minor gaps in dispatch ship ordering and FEFO plan-phase window |
| Multi-tenant safety | **88** | HTTP + websocket room isolation; defense-in-depth gap on `complete()` tenant assert |
| RBAC safety | **86** | Admin/operator split on mutations; operators can execute pick/dispatch |
| Workflow integrity | **78** | Recovery/cancel paths improved; dispatch still uses “latest completed pick” heuristic |
| Operational reliability | **72** | No automated regression tests; ops must use consistency API manually |
| **Overall backend maturity** | **80** | **Qualified production-ready** for controlled rollout with monitoring |

**Production readiness:** Suitable for **pilot / early production** with operational guardrails: run `GET /inventory/consistency/validate` after incidents, alert on `INVENTORY_INTEGRITY_VIOLATION`, and treat Phase 2.1 dispatch-binding as a known limitation until explicitly fixed.

---

# Methodology

## What was inspected

| Area | Primary files |
|------|----------------|
| Pick reservation lifecycle | `warehouse-tasks.service.ts`, `task-inventory-effects.service.ts`, `pick-concurrency.util.ts` |
| Stock mutations | `stock.helpers.ts`, `inventory-consistency.service.ts` |
| Idempotency | `warehouse-tasks.service.ts` (`complete`), `ledger-idempotency.service.ts` |
| Workflow recovery | `workflow-recovery.service.ts` |
| State machine | `task-transitions.ts` |
| Tenant / RBAC | `company-access.service.ts`, `realtime.gateway.ts`, `warehouse-tasks.controller.ts` |
| DB constraints | `prisma/migrations/0_init/migration.sql` (`current_stock` CHECKs, `fn_reconcile_reservations`) |

## What was not executed

- No Jest/e2e test runs (no tests present).
- No multi-client race harness (would require scripted parallel HTTP/WebSocket clients against a live DB).
- No production database sampling.

Findings are labeled **confirmed** (directly follows from code/DB), **likely** (strong inference from transaction boundaries), or **theoretical** (requires rare orchestration or external misuse).

---

# Detailed Findings

## F-01 — Dispatch binds to “latest completed pick,” not a deterministic pick task

| Field | Value |
|-------|--------|
| **Severity** | High |
| **Status** | Confirmed (pre-existing; documented in Phase 2.1, not fixed in 2.2–2.6) |
| **Files** | `warehouse-tasks.service.ts` (`complete` → `dispatch`), `task-inventory-effects.service.ts` (`applyDispatchShip`) |

**Reproduction scenario:** Workflow instance has two `pick` tasks that reached `completed` (e.g. fork/remediation). Dispatch `complete()` loads:

```typescript
const pickSibling = await tx.warehouseTask.findFirst({
  where: { workflowInstanceId, taskType: 'pick', status: 'completed' },
  orderBy: { completedAt: 'desc' },
});
```

**Risk:** Dispatch may ship reservations from the **wrong** pick task. `applyDispatchShip` decrements **all** slices in that sibling’s `executionState`, while `body.lines` only validates ship qty vs `pickedQuantity` per line—not slice coverage.

**Recommended fix (incremental):** Store `pick_task_id` on dispatch task payload/executionState at enqueue time; load reservations only from that task. Minimum: reject dispatch if multiple completed picks exist.

---

## F-02 — `applyDispatchShip` does not sort reservation slices before stock decrement

| Field | Value |
|-------|--------|
| **Severity** | Medium |
| **Status** | Confirmed (regression vs Phase 2.5 doc claim) |
| **Files** | `task-inventory-effects.service.ts` (`applyDispatchShip` loop ~L467) |

**Evidence:** `buildPickReservations` and `releaseReservations` use `sortReservationSnapshotsForLocking()`. Dispatch ship loop uses raw `for (const r of reservations)`.

**Risk:** Under concurrent dispatch/shipment on overlapping bins (different orders), lock acquisition order may differ from pick reservation order → **deadlock probability** increases (not incorrect totals if transactions serialize).

**Recommended fix:** `for (const r of sortReservationSnapshotsForLocking(reservations))` in `applyDispatchShip`.

---

## F-03 — `patchProgress` can overwrite `executionState.reservations`

| Field | Value |
|-------|--------|
| **Severity** | Medium |
| **Status** | Confirmed |
| **Files** | `warehouse-tasks.service.ts` (`patchProgress`) |

**Evidence:**

```typescript
const next = { ...cur, ...patch };
await tx.warehouseTask.update({ data: { executionState: next } });
```

There is no guard preventing a client patch from replacing or clearing `reservations` while pick is `in_progress`.

**Risk:** Stock remains reserved in `current_stock`, but task snapshot no longer matches → dispatch fails or `TASK_RESERVATION_STOCK_DRIFT` in consistency API; manual recovery required.

**Recommended fix:** For `taskType === 'pick'`, forbid patches that touch `reservations` (or merge only allowlisted keys like `pickPathOrderedIds`).

---

## F-04 — Completed pick tasks cannot be cancelled; orphan reserved stock until dispatch/cancel_remaining

| Field | Value |
|-------|--------|
| **Severity** | Medium |
| **Status** | Confirmed (by design + state machine) |
| **Files** | `task-transitions.ts`, `warehouse-tasks.service.ts` (`cancel`) |

**Evidence:** `canTransitionTask('completed', …)` only allows `cancelled` from terminal in edge cases; `completed` has no outgoing edges except none. Pick `cancel()` releases reservations only for cancellable states.

**Mitigations present (Sprint 2.4):** `cancel` on **dispatch** releases all pick snapshots in workflow; `resolveBlocked(cancel_remaining)` releases pick reservations for outbound workflows.

**Residual risk:** Workflow abandoned without dispatch cancel or `cancel_remaining` (e.g. ops marks workflow done out-of-band) → reserved stock until consistency report + manual `RELEASE_RESERVATIONS_OUTBOUND` recovery.

**Recommended fix (ops):** Run consistency validate after abnormal closures; document SOP. Code: optional workflow-instance cancel hook (out of scope for “no redesign”).

---

## F-05 — `complete()` omits in-transaction `assertTaskWorkflowTenant`

| Field | Value |
|-------|--------|
| **Severity** | Low (mitigated) |
| **Status** | Likely safe via guard; defense-in-depth gap |
| **Files** | `warehouse-tasks.service.ts` (`complete`), `workflow-execution-gate.guard.ts` |

**Evidence:** `start`, `cancel`, `fail`, `patchProgress` call `assertTaskWorkflowTenant` inside the transaction. `complete()` does not; it relies on `WorkflowExecutionGateGuard` → `ensureRunnableForExecutionGate` → `assertTaskWorkflowTenant` **before** the handler runs.

**Risk:** If `complete` is ever invoked without the guard (internal call, future endpoint), cross-tenant mutation is possible.

**Recommended fix:** Add `assertTaskWorkflowTenant(user, task.workflowInstance.companyId)` immediately after loading task in `complete()` (mirror `cancel`).

---

## F-06 — FEFO candidate read is unlocked (plan phase) before per-row `FOR UPDATE`

| Field | Value |
|-------|--------|
| **Severity** | Low |
| **Status** | Likely safe (transaction rollback) |
| **Files** | `task-allocation.helper.ts`, `task-inventory-effects.service.ts` (`buildPickReservations`) |

**Scenario:** Two picks on **different** workflows reserve the same bin concurrently. Both read the same `quantity_available` in plan phase; both attempt `incrementReservedWithMeta`; second UPDATE fails `quantity_on_hand - quantity_reserved >= qty` → transaction rolls back.

**Risk:** Spurious pick start failures under contention (operational noise), not silent double allocation.

**Recommended fix (scale phase):** Optional `SELECT … FOR UPDATE` on planned rows before increment, or retry pick start on `InsufficientStockException`.

---

## F-07 — `stock_reservations` table drift warnings expected in task-only path

| Field | Value |
|-------|--------|
| **Severity** | Low (informational) |
| **Status** | Confirmed |
| **Files** | `inventory-consistency.service.ts`, `0_init/migration.sql` (`fn_reconcile_reservations`) |

**Evidence:** App mutates `current_stock.quantity_reserved` directly; Prisma schema does not model `stock_reservations`. DB trigger syncs reserved qty from `stock_reservations` only when that table changes.

**Risk:** Consistency API may emit `STOCK_RESERVATION_TABLE_DRIFT` warnings that are **benign** in task-only mode.

**Recommended fix:** Document as expected; or gate that check behind config flag.

---

## F-08 — No automated regression tests for Sprint 2 guarantees

| Field | Value |
|-------|--------|
| **Severity** | High (process) |
| **Status** | Confirmed |
| **Files** | N/A — `backend/src` has zero test files |

**Risk:** Future refactors can reintroduce orphan reservations, break idempotency, or weaken locks without CI detection.

**Recommended fix:** Add focused integration tests: concurrent `pick.start`, double `pick.complete`, `dispatch.complete` replay, `cancel_remaining` release, consistency validate snapshots.

---

## F-09 — Pick `complete` lacks workflow-level locks (dispatch has them)

| Field | Value |
|-------|--------|
| **Severity** | Low |
| **Status** | Likely safe via DAG |
| **Files** | `warehouse-tasks.service.ts` |

**Evidence:** Dispatch `complete` calls `lockWorkflowInstance`, `lockWorkflowPickTasks`, `lockOutboundOrder`. Pick `complete` only locks task row + outbound order (inside `applyPickRecord`).

**Risk:** Theoretically overlaps with dispatch if frontier checks were bypassed; gate + state machine normally prevent this.

**Recommended fix:** Align pick `complete` with same workflow locks for symmetry (optional hardening).

---

## F-10 — `retry()` does not validate reservation snapshot still matches stock

| Field | Value |
|-------|--------|
| **Severity** | Low |
| **Status** | Theoretical |
| **Files** | `warehouse-tasks.service.ts` (`retry`) |

**Evidence:** `retry_pending → in_progress` preserves `executionState` without re-validation.

**Risk:** If reservations were partially released via recovery between states, retry continues with stale/empty snapshots.

**Recommended fix:** On retry for pick tasks, assert non-empty reservations or force `start()` to re-reserve.

---

# Concurrency Analysis

## Lock ordering review

| Operation | Locks acquired (order) |
|-----------|-------------------------|
| `pick.start` | `warehouse_tasks` (task) → `workflow_instances` → all pick tasks in WF → `outbound_orders` → per-slice `current_stock` (**sorted** by `stockTupleLockKey`) |
| `pick.complete` | `warehouse_tasks` → `outbound_orders` (in `applyPickRecord`) |
| `dispatch.complete` | `warehouse_tasks` → `workflow_instances` → pick tasks → `outbound_orders` → `current_stock` per slice (**unsorted** in ship loop — see F-02) |
| `cancel` (pick) | `warehouse_tasks` → release slices (**sorted**) → clear executionState |
| `fail` (pick) | Same as cancel path for reservations |

**Verdict:** Global sort order on reserve/release is **correct** and reduces deadlock risk across concurrent picks. Dispatch ship should adopt the same sort.

## Transaction boundary review

| Path | Transaction scope | Rollback on failure |
|------|-------------------|---------------------|
| `start` (pick) | Single `$transaction` includes all reservations + executionState write | Yes — partial reservations not committed |
| `complete` | Side effects + `bumpStatus` + orchestration hooks in one TX | Yes |
| `cancel` / `fail` | Release + status bump atomic | Yes |
| `recoverWorkflowInstance` | Per-action release in one TX | Yes |

**Verdict:** Boundaries are **well-placed** for inventory integrity.

## Deadlock risk analysis

- **Cross-workflow, same bin:** Mitigated by sorted `incrementReservedWithMeta` / `releaseReservedWithMeta`.
- **Same workflow, two pick starts:** Mitigated by `lockWorkflowPickTasks` + `assertExclusiveActivePickInWorkflow`.
- **Dispatch vs pick:** Mitigated by DAG / execution gate (pick must complete before dispatch is runnable).
- **Remaining risk:** Unsorted dispatch decrements (F-02) under multi-order contention.

## Rollback safety analysis

- Stock helpers throw `InsufficientStockException` / `InventoryIntegrityException` → Prisma rolls back entire transaction.
- `bumpStatus` uses `lockVersion` — concurrent status updates get `409`-style `ConflictException` instead of silent overwrite.
- Idempotent `complete` returns early **inside** transaction without re-running side effects — **confirmed safe** for pick/dispatch replay.

---

# Reservation Integrity Analysis

## Protections implemented (Sprint 2.2–2.4)

| Scenario | Mechanism | Verdict |
|----------|-----------|---------|
| Double reservation on pick restart | `start()` releases existing snapshots before `buildPickReservations` | **Mitigated** |
| Duplicate slices in executionState | `mergeReservationSnapshots` on build/release | **Mitigated** |
| Pick cancel / fail | `releaseTaskHeldReservations` + `executionState = null` | **Mitigated** |
| Dispatch cancel | `releaseOutboundPickReservationsInWorkflow` | **Mitigated** |
| `cancel_remaining` | Releases all pick snapshots in outbound WF | **Mitigated** |
| Successful dispatch | Clears pick sibling `executionState` after ship | **Mitigated** |
| Compensation recovery | TX re-validates `workflowInstanceId`; clears executionState after release | **Mitigated** |

## Orphan reservation analysis

**Remaining orphan paths:**

1. Completed pick + workflow abandoned without dispatch cancel / `cancel_remaining` (F-04).
2. Client corrupts reservations via `patchProgress` (F-03).
3. Manual DB edits bypassing app.

**Detection:** `GET /inventory/consistency/validate` — codes `TASK_RESERVATION_STOCK_DRIFT`, `STALE_PICK_RESERVATION_SNAPSHOT`, stock row invariant codes.

## Stale snapshot analysis

- After successful dispatch, pick `executionState` cleared — **good**.
- After pick complete, snapshots **intentionally retained** until dispatch consumes stock — **correct**.
- Consistency checker flags completed pick with snapshots on **shipped** orders (`STALE_PICK_RESERVATION_SNAPSHOT`) — useful hygiene signal.

## Reservation consistency review

| Invariant | Enforcement |
|-----------|-------------|
| `reserved ≤ on_hand` | DB CHECK + UPDATE WHERE + post-mutation `assertStockRowInvariants` |
| `available = on_hand - reserved` | Generated column + consistency validator |
| Task snapshot ↔ stock | Consistency API (warning-level aggregate) |
| Picked vs requested | Consistency API + `applyPickRecord` validation |

---

# Idempotency Analysis

## Replay safety

| Endpoint | Behavior when task already `completed` | Side effects |
|----------|--------------------------------------|--------------|
| `POST /tasks/:id/complete` (pick) | `idempotentPickNoop = true`; early `return` in TX | No stock/order/orchestration/notifications/cache/realtime |
| `POST /tasks/:id/complete` (dispatch) | `idempotentDispatchNoop = true` | Same protections |

**Confirmed** in `warehouse-tasks.service.ts` lines ~771–787, ~916–936.

## Duplicate completion protection

- **Task layer:** Status gate + idempotent noop.
- **Stock layer:** Dispatch would fail on second in-progress attempt; noop prevents second attempt after completed.
- **Ledger layer:** `LedgerIdempotencyService.appendIfAbsent` — duplicate ledger keys skipped (dispatch ship uses deterministic keys including task/line/loc/lot/qty).

## Websocket replay safety

- Realtime emits are **skipped** on idempotent noop (`emitTaskUpdatedByTaskId`, notifications).
- Websocket itself does not replay HTTP; clients replaying HTTP get safe noops **confirmed**.
- Socket rooms are tenant-scoped (`tenant:company:{id}`) — events do not cross companies **confirmed** in `realtime.gateway.ts`.

**Gap:** Idempotency is **not** keyed by client request id — only by task terminal state. Two simultaneous in-flight completes while `in_progress` serialize on `lockTask` — safe.

---

# Workflow Integrity Analysis

## State machine (`task-transitions.ts`)

| Transition | Reservation impact |
|------------|-------------------|
| `in_progress → failed` (via `fail`) | Pick: released |
| `in_progress → cancelled` | Pick/dispatch cancel paths |
| `failed → pending` (`reopen`) | No release; `start()` releases before re-reserve |
| `retry_pending → in_progress` | Preserves snapshots (see F-10) |
| `blocked → cancel_remaining` | Outbound: releases all pick snapshots |

## Workflow recovery safety

- Preview validates task belongs to instance.
- Execution TX re-checks `task.workflowInstanceId` (Phase 2.4 fix).
- `RELEASE_RESERVATIONS_OUTBOUND` clears `executionState` after release.

## Cancellation safety

- Admin-only: `cancel`, `fail`, `skip`, `resolve`, `retry`, `reopen`.
- Operators: `start`, `complete`, `progress`, `lease` (with assignment + frontier checks).

## Reopen / retry safety

- **Reopen:** Does not clear executionState; relies on prior `fail()` release or subsequent `start()` safeguard — **acceptable**.
- **Retry:** Does not re-reserve; assumes existing snapshots still valid — **see F-10**.

---

# Inventory Consistency Validation (Phase 2.6)

## API

`GET /inventory/consistency/validate?companyId=&warehouseId=` (ADMIN)

## Coverage vs audit requirements

| Requirement | Covered by checker |
|-------------|-------------------|
| Reserved qty | `RESERVED_EXCEEDS_ON_HAND`, negatives |
| Available qty | `AVAILABLE_FORMULA_MISMATCH`, `NEGATIVE_AVAILABLE` |
| On-hand qty | `NEGATIVE_ON_HAND` |
| Allocated qty (task path) | Derived from pick snapshots vs lines |
| Picked qty | `OUTBOUND_PICKED_EXCEEDS_REQUESTED`, allocation mismatches |
| Concurrent active picks | `CONCURRENT_ACTIVE_PICKS` |
| Legacy table drift | `STOCK_RESERVATION_TABLE_DRIFT` |

## Runtime safeguards

`StockHelpers` calls `assertStockRowInvariants` after reserve/release/ship → throws `INVENTORY_INTEGRITY_VIOLATION` (**confirmed** in `stock.helpers.ts`).

**Operational recommendation:** Schedule validate after pick/dispatch incidents; block go-live batches if `healthy: false`.

---

# Multi-Tenant Isolation Regression

| Layer | Mechanism | Status |
|-------|-----------|--------|
| HTTP reads/writes | `CompanyAccessService`, `readCompanyIdFilter` | Implemented (Phase 1.1–1.2) |
| Task list/detail | `getReadFilterCompanyId`, `fetchTaskAuthorized` | Confirmed |
| Task mutations | `assertTaskWorkflowTenant` on most paths; `complete` via guard only | See F-05 |
| Websocket | JWT + room join `tenant:company:{id}`; mismatch rejected | Confirmed |
| Inventory validate | Scoped by `companyId` query + tenant filter | Confirmed |
| Reservations | `companyId` on each slice; stock rows keyed by company | Confirmed |

**No evidence** of cross-tenant stock mutation paths in reviewed pick/dispatch code.

---

# RBAC Regression

| Action | Operator | Admin |
|--------|----------|-------|
| `start` / `complete` / `progress` / `lease` | Yes (assigned + frontier) | Yes |
| `cancel` / `fail` / `skip` / `resolve` / `retry` / `reopen` | No | Yes |
| `assign` / `unassign` | No | Yes |
| `GET /inventory/consistency/validate` | No | Yes |
| Workflow recovery | No | Yes (`wh_manager`, `super_admin`) |

**Confirmed** via `warehouse-tasks.controller.ts` and service-level role checks.

---

# Simulated Concurrency Scenarios (Code-Path Analysis)

| Scenario | Expected outcome | Assessment |
|----------|------------------|------------|
| Two `pick.start` same workflow | Second blocked: `assertExclusiveActivePickInWorkflow` | **Pass** |
| Two `pick.start` different workflows, same bin | Sorted locks; one may fail `InsufficientStockException` | **Pass** |
| Two `pick.complete` same task (replay) | Second: idempotent noop | **Pass** |
| Two `pick.complete` parallel before first commits | `lockTask` serializes; second noop or conflict | **Pass** |
| Two `dispatch.complete` replay | Second: idempotent noop | **Pass** |
| `pick.complete` + `dispatch.complete` parallel | Frontier should block; if not, outbound row lock serializes | **Likely pass** |
| `cancel` pick during `pick.start` | Task row lock serializes | **Pass** |
| `cancel_remaining` + active dispatch | Dispatch row locks; cancel_remaining on blocked task | **Ops-dependent** |

---

# Production Readiness Assessment

## Production-ready (with monitoring)

- Core stock mutation invariants (CHECK constraints + conditional UPDATE + post-assert).
- Pick reservation build/release in single transaction.
- Pick/dispatch completion idempotency for HTTP replay.
- Concurrent pick protection within a workflow instance.
- Release-on-failure paths for cancel, fail, dispatch cancel, cancel_remaining, recovery.
- Tenant isolation (HTTP + websocket).
- RBAC on privileged workflow mutations.
- Consistency validation API for ops/audit.

## Needs hardening before high-scale multi-tenant production

1. **Automated integration tests** (F-08) — highest ROI.
2. **Dispatch ↔ pick binding** (F-01) — correctness under remediation/fork flows.
3. **patchProgress reservation guard** (F-03).
4. **Sorted dispatch ship decrements** (F-02) — deadlock hygiene.

## Can wait until scale phase

- FEFO pre-lock read optimization (F-06).
- `stock_reservations` table alignment or checker flag (F-07).
- Symmetric workflow locks on pick complete (F-09).

---

# Final Scores

| Category | Score |
|----------|-------|
| Inventory integrity | **82** |
| Concurrency safety | **84** |
| Multi-tenant safety | **88** |
| RBAC safety | **86** |
| Workflow integrity | **78** |
| Operational reliability | **72** |
| **Overall backend maturity** | **80** |

---

# Appendix — Code Landmarks

| Concern | Location |
|---------|----------|
| Pick start safeguards | `warehouse-tasks.service.ts` `start()` ~L674–722 |
| Pick/dispatch idempotency | `warehouse-tasks.service.ts` `complete()` ~L771–787, ~L916–936 |
| Release helpers | `releaseTaskHeldReservations`, `releaseOutboundPickReservationsInWorkflow` |
| Sorted reservation locks | `pick-concurrency.util.ts`, `buildPickReservations` |
| Stock row locks | `stock.helpers.ts` `incrementReservedWithMeta`, `decrementShippedWithMeta` |
| Post-mutation assert | `inventory-consistency.service.ts` `assertStockRowInvariants` |
| Consistency report | `inventory-consistency.service.ts` `runValidation` |
| Recovery TX scope | `workflow-recovery.service.ts` ~L91–105 |
| State machine | `task-transitions.ts` |

---

*End of Sprint 2 Reliability Audit.*
