# Phase 2.6 — Inventory Consistency Validation

**Status:** Implemented (validation reports + post-mutation safeguards)  
**Date:** 2026-05-26  
**Scope (per Phase 2.6):**
- validate reserved, available, allocated (task snapshots), picked, and on-hand quantities
- detect negative stock, impossible states, inconsistent reservations, corrupted rows
- generate structured validation reports and runtime integrity guards

**Non-goals:**
- no workflow redesign
- no automatic repair / reconciliation jobs (report-only + fail-fast guards)
- no changes to `stock_reservations` write path (task flow uses `current_stock` directly)

---

## Problem

Inventory integrity spans:
- `current_stock` (`quantity_on_hand`, `quantity_reserved`, generated `quantity_available`)
- pick-task `executionState.reservations` snapshots
- outbound line `picked_quantity` vs `requested_quantity`
- legacy `stock_reservations` table (DB trigger sync — may drift from task-only path)

Without validation, silent drift causes phantom locked stock, double-pick risk, or impossible `reserved > on_hand` states.

---

## Implementation

### 1) Validation report API

**Endpoint:** `GET /inventory/consistency/validate`  
**Auth:** admin roles (`AuthGroup.ADMIN`)  
**Query:** optional `companyId`, `warehouseId` (tenant-scoped via `CompanyAccessService`)

**Response:** `InventoryConsistencyReport`
- `healthy` — `true` when zero **critical** findings
- `summary` — counts by severity + rows scanned
- `findings[]` — structured issues with codes, severity, entity ids, details

### 2) Checks performed

| Code | Severity | What it detects |
|------|----------|-----------------|
| `NEGATIVE_ON_HAND` | critical | `quantity_on_hand < 0` |
| `NEGATIVE_RESERVED` | critical | `quantity_reserved < 0` |
| `NEGATIVE_AVAILABLE` | critical | `quantity_available < 0` |
| `RESERVED_EXCEEDS_ON_HAND` | critical | reserved > on-hand |
| `AVAILABLE_FORMULA_MISMATCH` | critical | available ≠ on-hand − reserved |
| `STOCK_RESERVATION_TABLE_DRIFT` | warning | `fn_reconcile_reservations()` drift vs `stock_reservations` |
| `TASK_RESERVATION_STOCK_DRIFT` | warning | sum(task snapshots) ≠ `quantity_reserved` per bin/lot |
| `OUTBOUND_PICKED_EXCEEDS_REQUESTED` | critical | picked > requested on line |
| `OUTBOUND_NEGATIVE_PICKED` | critical | picked < 0 |
| `OUTBOUND_ALLOCATED_PICKED_MISMATCH` | warning | picked > active task-allocated qty |
| `OUTBOUND_PICKED_WITHOUT_RESERVATION` | warning | picked > 0 but no active task snapshots |
| `CONCURRENT_ACTIVE_PICKS` | critical | >1 in-progress pick per workflow |
| `STALE_PICK_RESERVATION_SNAPSHOT` | warning | completed pick snapshots after order shipped |

**Allocated quantity** in the task-only flow is derived as the sum of active pick-task reservation slices per outbound line (not `outbound_allocations`, which is unused by the app layer).

### 3) Post-mutation integrity safeguards

**File:** `backend/src/modules/inventory/stock.helpers.ts`

After successful:
- `incrementReservedWithMeta`
- `releaseReservedWithMeta`
- `decrementShippedWithMeta`

→ `InventoryConsistencyService.assertStockRowInvariants()` re-reads the row and throws `InventoryIntegrityException` (`INVENTORY_INTEGRITY_VIOLATION`) if invariants fail.

This fail-fast guard prevents committing transactions that leave impossible stock states.

### 4) Programmatic assert helper

`InventoryConsistencyService.assertScopeHealthy({ companyId?, warehouseId? })` runs the full report and throws when critical issues exist — suitable for ops scripts or future cron hooks.

---

## Files added / changed

- `backend/src/modules/inventory/inventory-consistency.types.ts` (new)
- `backend/src/modules/inventory/inventory-consistency.service.ts` (new)
- `backend/src/modules/inventory/dto/consistency-query.dto.ts` (new)
- `backend/src/modules/inventory/inventory.controller.ts`
- `backend/src/modules/inventory/inventory.module.ts`
- `backend/src/modules/inventory/stock.helpers.ts`
- `backend/src/common/errors/domain-exceptions.ts` — `InventoryIntegrityException`

---

## Verification

- `npx tsc --noEmit` (backend) passes.
- Example: `GET /inventory/consistency/validate?companyId=<uuid>`

---

## Operational notes

- **Warning** findings (e.g. `STOCK_RESERVATION_TABLE_DRIFT`) may appear in task-only deployments where `stock_reservations` rows are never written but `current_stock.quantity_reserved` is updated directly — investigate before auto-repairing.
- Run validation after incident response (stuck reservations, failed picks) before manual SQL fixes.
