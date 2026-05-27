# Phase 2.7.3 — Complete Tenant Assert

**Status:** Implemented (defense-in-depth tenant assertion)  
**Date:** 2026-05-27  
**Scope:** Add explicit in-transaction tenant validation in `WarehouseTasksService.complete()` only.

---

## Exact Assertion Location

**File changed**
- `backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts`

**Method**
- `complete(taskId, user, bodyRaw)`

**Insertion point**
- Immediately after loading `task` inside the transaction:
  - `if (!task) throw new NotFoundException('Task not found.');`
  - **added:** `this.assertTaskWorkflowTenant(user, task.workflowInstance.companyId);`
  - then existing task-type/status checks continue unchanged.

---

## Why Defense-in-Depth Matters

`complete()` already passes through `WorkflowExecutionGateGuard`, which calls `ensureRunnableForExecutionGate()` and currently performs tenant validation.

Adding the same tenant assertion **inside the transaction** closes a defense-in-depth gap by ensuring tenant ownership is re-validated at mutation time, consistent with:
- `start()`
- `cancel()`
- `fail()`
- `patchProgress()`

This reduces future regression risk if:
- guard wiring changes,
- new internal invocation paths are introduced,
- route-level protections are accidentally bypassed.

---

## Attack / Misuse Paths Mitigated

This patch explicitly blocks cross-tenant mutation attempts in `complete()` even if guard-level protections are weakened or bypassed:

- Internal service call to `complete()` without guard path
- Future endpoint reuse/misconfiguration that omits `WorkflowExecutionGateGuard`
- Defense-in-depth gap during refactors that alter pre-handler authorization flow

Result: transaction now fails before any stock/task/order mutation when tenant ownership does not match.

---

## Behavior and Compatibility

No functional workflow or API behavior changes:

- no DTO/schema/payload changes
- no task state-machine changes
- no lock ordering/transaction boundary changes
- no guard/RBAC architecture changes

Only an additional in-transaction authorization assertion is added.

---

## Regression Risk Assessment

**Risk level:** Very Low

Reasons:
- Single-line assertion in already-authorized mutation path
- Mirrors established pattern used by other task mutations
- Typecheck/lints clean
- No side-effect logic altered

Expected impact:
- Legitimate same-tenant requests unaffected
- Cross-tenant calls fail earlier and more explicitly

---

## Validation Summary

- `npx tsc --noEmit` passes.
- No linter errors in modified file.
- Manual code inspection confirms `complete()` now enforces tenant ownership inside transaction scope.

