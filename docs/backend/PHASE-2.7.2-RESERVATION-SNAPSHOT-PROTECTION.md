# Phase 2.7.2 — Reservation Snapshot Protection

**Status:** Implemented (targeted reservation integrity patch)  
**Date:** 2026-05-27  
**Scope:** Protect `executionState.reservations` from client mutation through `patchProgress()` for pick tasks only.

---

## Exact Protections Added

**File changed**
- `backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts`

**Method changed**
- `patchProgress()`

**Protection logic**
1. For `task.taskType === 'pick'`, incoming `execution_state_patch.reservations` is stripped before merge.
2. After merge, existing server-side `cur.reservations` is explicitly re-applied to `next`.
3. Progress event payload keys now reflect sanitized patch keys (`patchForMerge`), not raw client input.

This makes reservation snapshots backend-owned and immutable from client progress updates.

---

## Attack/Corruption Scenarios Mitigated

The patch blocks client-side corruption via `PATCH /tasks/:id/progress` for pick tasks:

- **Reservation overwrite**
  - Client sends `{ reservations: [...] }` to replace backend snapshot.
  - Result: ignored; backend snapshot preserved.

- **Reservation deletion / clear**
  - Client sends `{ reservations: [] }` or `{ reservations: null }`.
  - Result: ignored; backend snapshot preserved.

- **Stale snapshot injection**
  - Client sends older/stale FEFO slices to force drift.
  - Result: ignored; backend snapshot preserved.

- **Snapshot drift trigger attempts**
  - Client attempts to force mismatch between `executionState` and stock reservation state.
  - Result: direct patch vector removed for pick progress path.

---

## Affected `executionState` Fields

For **pick tasks**:
- `reservations` => **immutable (backend-owned)**

For **all other fields** in pick progress payload:
- unchanged behavior (still merge-based)

For **non-pick tasks**:
- unchanged behavior (existing merge semantics preserved)

---

## Compatibility Impact

### What remains compatible
- Pick UI progress metadata updates continue to work (all non-`reservations` fields still patchable).
- Existing progress API contract stays unchanged.
- Task lifecycle and workflow semantics unchanged.

### Intended behavior change
- Any client attempting to patch `reservations` on pick tasks will no longer affect stored execution state.

---

## Regression Risk Assessment

**Risk level:** Low

Reasons:
- Narrow scope (single method, pick-only conditional).
- No transaction boundary changes.
- No DTO/schema/contract changes.
- No change to reservation generation/release/dispatch semantics.
- Typecheck and lints clean.

Residual consideration:
- Clients that (incorrectly) depended on mutating `reservations` will now be safely ignored by design.

---

## Validation Summary

- `npx tsc --noEmit` passes.
- No linter errors in modified file.
- Code inspection confirms:
  - progress updates still merge for allowed fields
  - pick `reservations` cannot be modified, replaced, or cleared by clients
  - backend-only ownership of reservation snapshots is enforced in `patchProgress()`.

