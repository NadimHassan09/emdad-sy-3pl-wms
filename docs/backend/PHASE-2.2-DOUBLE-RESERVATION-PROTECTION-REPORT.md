# Phase 2.2 — Double Reservation Protection (Report)

**Status:** Implemented (reservation integrity safeguards)  
**Date:** 2026-05-26  
**Scope (per Phase 2.2):**
Prevent:
- duplicate reservations
- over-allocation
- multiple active reservation slices on the same inventory unit tuples

**Non-goals:**
- no picking workflow redesign
- no inventory architecture redesign
- no changes to reservation ledger schema

---

## What was fixed

### 1) Release existing reservations before re-allocating on pick start

**Risk addressed:** potential double reservation when a pick task is restarted (e.g., via reopen/retry paths) while `executionState.reservations` still contains previously reserved slices.

**Change:**
- File: `backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts`
- In `start()` when `task.taskType === 'pick'`:
  - parse `task.executionState.reservations`
  - if non-empty, call `this.effects.releaseReservations(tx, existingExec.reservations)`
  - then proceed to allocate the fresh reservation set for the current pick payload.

**Integrity outcome:**
- prevents stacking new reservations on top of already-reserved stock units
- ensures only one reservation set is “active” for that pick task execution cycle

---

### 2) Ensure executionState reservation slices are unique per inventory unit tuple

**Risk addressed:** multiple active reservation slice entries for the same inventory unit tuple could exist in `executionState`, increasing the chance of inconsistent completion validation or repeated consumption.

**Change:**
- File: `backend/src/modules/warehouse-workflow/task-inventory-effects.service.ts`
- In `buildPickReservations()`:
  - after building the slice list, merge duplicate slices keyed by:
    - `outboundOrderLineId`
    - `companyId`
    - `productId`
    - `locationId`
    - `lotId` (or `null`)
  - duplicate slice quantities are summed so reserved totals remain equivalent.

**Integrity outcome:**
- `executionState.reservations` is de-duplicated for the same inventory unit tuple
- completion matching logic has a more stable canonical reservation-slice set

---

## Transactional safeguards relied upon

These changes build on existing transaction/locking behavior:

1. `StockHelpers.incrementReservedWithMeta()` uses `FOR UPDATE` on `current_stock` rows and checks `(quantity_on_hand - quantity_reserved) >= qty` before incrementing `quantity_reserved`.
2. Reservation release uses `releaseReservedWithMeta()` which locks reserved rows and decrements `quantity_reserved` atomically with constraints.

Together with the new protections, this prevents:
- over-allocation due to race conditions
- reservation stacking across pick restarts

---

## What invariants these safeguards protect

1. **No reservation stacking for a pick restart**
   - a fresh `pick` allocation cannot run on top of old reserved slices.
2. **Single canonical slice per inventory tuple inside executionState**
   - executionState never contains duplicate slices for the same inventory unit tuple.
3. **Reserved totals remain consistent**
   - deduplication merges quantities, preserving the total reserved amount.

---

## Remaining reservation risks (not changed in Phase 2.2)

The Phase 2.1 audit still contains other integrity risks that are **not** solved by this phase:

1. **Dispatch validation completeness**
   - dispatch currently uses reservations from a “latest completed pick sibling” and relies on `executionState.reservations` content.
   - it does not hard-bind dispatch payload lines to reservation slice membership.
2. **Orphan reservations on workflow cancellation paths**
   - some cancellation/resolve paths may still leave `quantity_reserved` held when completed pick tasks are no longer later dispatched.
3. **Retry correctness is state-dependent**
   - retry paths depend on executionState validity and task lifecycle transitions.

These items were intentionally left out because Phase 2.2 focuses narrowly on *double reservation protection*.

---

## Files changed in Phase 2.2

- `backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts`
- `backend/src/modules/warehouse-workflow/task-inventory-effects.service.ts`

---

## Verification

- `npx tsc --noEmit` (backend) passes.
- No linter errors in modified files.

