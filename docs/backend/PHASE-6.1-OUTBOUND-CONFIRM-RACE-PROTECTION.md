# Phase 6.1 — Outbound Confirm Race Protection

**Status:** Implemented  
**Date:** 2026-05-29  
**Scope:** Outbound confirm transaction flow only — no workflow redesign, no inventory schema changes.

---

## Summary

| Area | Implementation |
|------|----------------|
| Row locking | `SELECT … FOR UPDATE` on `outbound_orders` per confirm transaction |
| State claim | Compare-and-set (`updateMany`) from `draft` / `pending_approval` → `picking` |
| Idempotent replay | Post-confirm statuses return existing order without side effects |
| Atomic ship CAS | Second-phase `picking` → `shipped` after deduction |
| Ledger idempotency | `LedgerIdempotencyService.appendIfAbsent` on outbound pick movements |
| Paths hardened | Task-only confirm, deferred-deduction confirm, atomic confirm-and-deduct |

---

## Race Conditions Found

### C1 — Read-check-then-update on confirm (critical)

**Location:** `OutboundService.confirmAndDeduct`, `confirmWithoutDeduction`

**Before:** Each path loaded the order, checked status (`draft` / `pending_approval`), then updated status and ran side effects (stock deduction, workflow bootstrap) without serializing concurrent callers.

**Impact under concurrent `POST /outbound-orders/:id/confirm`:**
- Double stock deduction (atomic path)
- Duplicate workflow / pick task bootstrap (task-only path)
- Duplicate audit, notification, and realtime events
- Inconsistent outbound status if partial failures interleaved

**Root cause:** Classic TOCTOU — two transactions could both observe confirmable status before either committed.

### C2 — Non-idempotent ledger writes on replay

**Location:** Atomic deduct loop (pre-refactor)

**Before:** Direct `inventoryLedger.create` even when idempotency keys existed in design comments but were not enforced via `LedgerIdempotencyService`.

**Impact:** Retried or partially replayed confirms could append duplicate ledger rows if status guards were bypassed.

### C3 — Side effects on idempotent HTTP replay

**Location:** All confirm paths (pre-refactor)

**Before:** Idempotent status checks happened outside or without gating post-transaction side effects (audit, notifications, websocket).

**Impact:** Safe data state could still produce duplicate operator-visible events on replay.

---

## Fixes Implemented

### 1) Outbound confirm lock utilities

**File:** `backend/src/modules/outbound/outbound-confirm-lock.util.ts`

| Function | Purpose |
|----------|---------|
| `lockOutboundOrderRow()` | PostgreSQL row lock on the outbound order |
| `claimOutboundConfirmableOrder()` | CAS transition only from confirmable statuses |
| `finalizeOutboundShipped()` | CAS `picking` → `shipped` after inventory deduction |
| `isOutboundConfirmable()` / `isOutboundPostConfirm()` | Shared status predicates |

**Confirmable:** `draft`, `pending_approval`  
**Post-confirm (idempotent replay):** `confirmed`, `picking`, `packing`, `ready_to_ship`, `shipped`

### 2) Transaction gate — `gateConfirmTransaction()`

**File:** `backend/src/modules/outbound/outbound.service.ts`

Single entry guard inside every confirm transaction:

1. `lockOutboundOrderRow`
2. Load order + lines + product status
3. Tenant / ownership validation
4. If post-confirm → `{ kind: 'idempotent', order }` (no mutation)
5. If not confirmable → `InvalidStateException`
6. Else → `{ kind: 'proceed', order }`

### 3) Confirm flow pattern (all paths)

```
BEGIN TRANSACTION
  gateConfirmTransaction()
  if idempotent → return existing order
  claimOutboundConfirmableOrder() → picking
  if claim lost → return replay order (idempotent)
  [path-specific work: workflow bootstrap | deduct | none]
  [atomic path: finalizeOutboundShipped()]
COMMIT
if fresh → emit audit / notifications / realtime once
```

**Side effects** (audit, notifications, websocket) run **only** when this request was the fresh claim (`fresh: true` / `idempotent: false`).

### 4) Atomic deduction extraction — `deductOutboundOrderLines()`

- FEFO stock walk unchanged
- `stock.decrementWithMeta()` per slice (existing row-level guards)
- `ledger.appendIfAbsent()` with deterministic keys:
  `bm:outbound:{orderId}:{productId}:line:{lineId}:loc:{locationId}:lot:{lotId|null}:{qty}`
- Line status → `done`, `pickedQuantity` set once inside the same transaction

### 5) Path coverage

| Path | Trigger | Protection |
|------|---------|------------|
| Task-only | `TASK_ONLY_FLOWS=true` (default) | Lock + CAS + workflow bootstrap in same TX; engine reuses active instance |
| Deferred deduction | `TASK_WORKFLOW_OUTBOUND_CONFIRM_DEFERS_DEDUCTION=true` | `confirmWithoutDeduction` uses same gate + CAS |
| Atomic ship | Both flags false | Lock + CAS + deduct + `finalizeOutboundShipped` CAS |

---

## Locking Strategy

```
outbound_orders row          FOR UPDATE (entire confirm transaction)
        ↓
claimOutboundConfirmableOrder   updateMany WHERE status IN (draft, pending_approval)
        ↓
[current_stock rows]            decrementWithMeta (existing stock row locks)
        ↓
finalizeOutboundShipped         updateMany WHERE status = picking
```

**Ordering:** Outbound order is locked first, serializing all confirm attempts for that order. Stock decrements inherit existing `StockHelpers` row-level consistency. No new cross-table lock ordering beyond outbound-order-first — consistent with Phase 2.5 pick protection which locks outbound orders before reservation.

**Lost CAS:** When `claimOutboundConfirmableOrder` returns `count !== 1`, the loser reloads the order and returns idempotently without side effects.

---

## Idempotency Protections

| Layer | Mechanism |
|-------|-----------|
| HTTP replay | Post-confirm status → return order, skip side effects |
| Concurrent confirm | CAS claim ensures one winner; loser idempotent |
| Ledger | `appendIfAbsent` + `ledger_idempotency` table |
| Workflow bootstrap | Engine returns existing active instance (unchanged) |
| Atomic finalize | `finalizeOutboundShipped` CAS prevents double ship |

---

## Remaining Risks

| Risk | Severity | Notes |
|------|----------|-------|
| Create-time vs confirm-time stock gap | Low | Documented race at order create; confirm-time decrement guards remain |
| Active workflow uniqueness | Addressed in Phase 6.2 | Partial unique index `workflow_instances_one_active_per_reference_uidx` |
| Cross-order concurrent confirms | N/A | By design — different order rows lock independently |
| `cancelled` replay | Low | Correctly rejected via `InvalidStateException` |
| Notification/audit on concurrent loser | None | Losers return before side-effect block |

---

## Validation / Testing

### Static

- `npx tsc --noEmit` — passes

### Integration (`npm run test:integration:sprint2`)

| Test | Assertion |
|------|-----------|
| `concurrent outbound confirm (task flow)` | Two parallel confirms → one workflow, one pick task, status `picking` |
| `concurrent outbound confirm (atomic ship)` | Two parallel confirms → status `shipped`, stock −5 once, one ledger row |
| `duplicate outbound confirm replay` | Sequential double confirm → stock −5 once |

**Files:**
- `backend/src/integration-tests/sprint2/sprint2-reliability.integration.ts`
- `backend/src/integration-tests/sprint2/reliability-test-helpers.ts` (`createOutboundServiceDeps`, `createDraftOutboundFixture`)

Atomic-path fixtures leave append-only `inventory_ledger` rows (and parent product/company rows) in the test DB; cleanup removes orders, stock, and workflows only.

### Manual smoke (recommended)

1. Create draft outbound with stock
2. Fire two parallel `POST /api/outbound-orders/:id/confirm` (with `warehouseId` when `TASK_ONLY_FLOWS=true`)
3. Verify single workflow and no double stock movement

---

## Files Changed

| File | Change |
|------|--------|
| `backend/src/modules/outbound/outbound-confirm-lock.util.ts` | **New** — row lock + CAS helpers |
| `backend/src/modules/outbound/outbound.service.ts` | Gate, CAS confirm flows, ledger idempotency |
| `backend/src/integration-tests/sprint2/reliability-test-helpers.ts` | Outbound confirm test fixtures |
| `backend/src/integration-tests/sprint2/sprint2-reliability.integration.ts` | Three outbound confirm race tests |

---

## Related Audits

- `docs/backend/SCOPE-ALIGNED-PRODUCTION-AUDIT.md` — Priority 0 outbound confirm race
- `docs/backend/ENTERPRISE-WMS-COMPLETE-AUDIT-AND-TEST-ANALYSIS.md` — C1
- `docs/backend/PHASE-2.5-CONCURRENT-PICK-PROTECTION.md` — complementary pick/dispatch locking
