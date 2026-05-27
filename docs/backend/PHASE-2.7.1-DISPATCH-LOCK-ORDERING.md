# Phase 2.7.1 — Dispatch Lock Ordering

**Status:** Implemented (targeted concurrency safety patch)  
**Date:** 2026-05-27  
**Scope:** Normalize dispatch stock decrement lock ordering only.

---

## Files Changed

- `backend/src/modules/warehouse-workflow/task-inventory-effects.service.ts`

---

## Patch Applied

In `applyDispatchShip()`, dispatch stock decrements now iterate in canonical tuple order:

- Before:
  - `for (const r of reservations)`
- After:
  - `for (const r of sortReservationSnapshotsForLocking(reservations))`

No other behavior changed:
- no payload/DTO changes
- no transaction boundary changes
- no reservation schema/semantics changes
- no workflow redesign

---

## Lock Ordering Paths (Post-Patch)

All reservation-related stock tuple mutations now use deterministic ordering:

1. **Reserve path**
   - `buildPickReservations()`
   - `mergeReservationSnapshots(planned)` → `sortReservationSnapshotsForLocking(...)`
   - `incrementReservedWithMeta(...)` in sorted order

2. **Release path**
   - `releaseReservations()`
   - `mergeReservationSnapshots(rows)` → `sortReservationSnapshotsForLocking(...)`
   - `releaseReservedWithMeta(...)` in sorted order

3. **Dispatch ship path (patched)**
   - `applyDispatchShip()`
   - `sortReservationSnapshotsForLocking(reservations)`
   - `decrementShippedWithMeta(...)` in sorted order

---

## Deadlock Scenarios Mitigated

This patch reduces deadlock probability when concurrent dispatch shipments touch overlapping `current_stock` tuples.

Mitigated pattern:
- Tx A locks tuple set in raw order `[X, Y]`
- Tx B locks tuple set in raw order `[Y, X]`
- circular wait becomes possible

Post-patch:
- both transactions acquire tuple locks in identical canonical order (e.g. `[X, Y]`)
- circular lock inversion risk is removed for this path

---

## Rollback Safety Confirmation

Rollback semantics remain unchanged:

- Dispatch shipping still runs inside the existing task transaction.
- `decrementShippedWithMeta()` still enforces stock constraints atomically.
- Any failure still aborts the transaction and rolls back stock/order/event mutations.

Only lock acquisition order changed; failure behavior did not.

---

## Concurrency Reasoning

Sprint 2 introduced deterministic lock ordering in reserve/release paths. Dispatch ship was the remaining inconsistency.  
By aligning dispatch with the same canonical sorter, all reservation-stock mutation paths now share one lock-order strategy, improving consistency and reducing lock-order inversion under load.

---

## Verification

- Code inspection confirms sorted ordering in:
  - `buildPickReservations()`
  - `releaseReservations()`
  - `applyDispatchShip()` (patched)
- `npx tsc --noEmit` passes.

