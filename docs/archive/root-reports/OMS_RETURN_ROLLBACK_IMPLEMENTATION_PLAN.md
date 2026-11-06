# OMS Returns Status Mapping + Safe Post-Receipt Rollback Implementation Plan

> **STAGING ONLY — INVESTIGATION & SPECIFICATION COMPLETE**  
> **Target Execution Role:** Antigravity / Sonnet / Flash  
> **Status:** Plan Only (No files modified, no migrations executed, no live carrier APIs invoked)

---

## 1. Executive Summary

### Existing Implementation & Context
1. **Returns Lifecycle & Database Model**:
   - `OmsReturnStatus` (PostgreSQL Enum `oms_return_status`): `requested`, `approved`, `rejected`, `completed`, `cancelled`.
   - `OmsOrderStatus` (PostgreSQL Enum `oms_order_status`): `return_pending_receipt`, `returned`, `out_for_delivery`, `shipped`, `delivered`, `failed_delivery`, etc.
   - When an OMS return is initiated, the return record is created with `status: requested`, and the parent `OmsOrder` is transitioned to `return_pending_receipt`.
   - When warehouse confirmation / scan confirmation occurs, warehouse inventory receives stock (upsert into `current_stock` + append into append-only partitioned `inventory_ledger` with `movement_type: return_receive` and `reference_type: return_order`), the return reaches `status: completed`, and the parent `OmsOrder` reaches `status: returned`.
2. **Current Label Gaps**:
   - In `/oms/returns` (`OmsCodReturnsPages.tsx`), status badges currently render raw strings (`{row.status.replace(/_/g, ' ')}`), displaying unmapped English words like `requested`, `completed`, and `cancelled` regardless of language settings.
   - The filters (`RETURN_STATUS_OPTIONS`) use English labels (`Return Pending Receipt`, `Approved`, `Rejected`, `Return Received`, `Cancelled`) without bilingual localization, and the table action column displays `'Done'` / `'مكتمل'` instead of the agreed status terminology.
   - Design system utilities (`statusMeta.ts`) already map `return pending receipt` to **مرتجع بانتظار الاستلام** and `returned` to **مرتجع مستلم**, but the return table was not using `StatusBadge` or unified status translation functions.
3. **Rollback Return Gap**:
   - A primitive super-admin helper `undoConfirmedReturn` exists in `ShippingAutoReturnService` (accessed via `/oms/orders/:id/undo-confirmed-return`), but:
     - It operates at the order level, not the return item level.
     - It forces the order to `ready_to_ship` rather than returning it to `out_for_delivery` or evaluating the carrier shipment status.
     - It does not verify whether the returned stock in the `Returns` quarantine location is still available or if it has been transferred, reserved, or consumed.
     - The Returns page (`/oms/returns` and `/oms/returns/:id`) lacks a dedicated Rollback button, permission checks, and inventory safety guards.
4. **Carrier / Webhook Reality**:
   - Neither Babel Express nor Sila SY supports an API endpoint to "un-cancel" or "reactivate" an already cancelled/superseded shipment.
   - If the carrier shipment was cancelled, attempting to mark the carrier active or re-send the old AWB is invalid. The rollback must restore local OMS order status safely while clearly flagging whether carrier re-dispatch is required.
   - Append-only PostgreSQL triggers (`trg_ledger_no_update`, `trg_ledger_no_delete`) strictly prohibit mutating past ledger rows. All reversals must be strictly compensating ledger movements (`movement_type: adjustment_negative`).

---

## 2. Current Architecture and Root Causes

| Component / Finding | Location | Status | Evidence / Notes |
| :--- | :--- | :--- | :--- |
| **Return Status Enum** | `backend/prisma/schema.prisma:524` | **VERIFIED** | `enum OmsReturnStatus { requested, approved, rejected, completed, cancelled }` |
| **Order Status Enum** | `backend/prisma/schema.prisma:403` | **VERIFIED** | Includes `return_pending_receipt`, `returned`, `out_for_delivery`, `shipped`, `delivered`, `failed_delivery` |
| **Returns Page Hardcoded Display** | `frontend/src/pages/OmsCodReturnsPages.tsx:789-830` | **VERIFIED** | Uses `row.status.replace(/_/g, ' ')`, unlocalized `RETURN_STATUS_OPTIONS`, and static `'Done'` action |
| **Design System Status Dict** | `shared/design-system/lib/statusMeta.ts:82-143` | **VERIFIED** | Maps `returned` → `مرتجع مستلم` and `return pending receipt` → `مرتجع بانتظار الاستلام` |
| **Ledger Immutability Triggers** | `backend/prisma/migrations/0_init/migration.sql:504-505` | **VERIFIED** | `trg_ledger_no_update` and `trg_ledger_no_delete` throw exceptions on `UPDATE` or `DELETE` |
| **Existing Order-level Undo** | `backend/src/modules/shipping/shipping-auto-return.service.ts:734` | **VERIFIED** | Reverses inventory blindly via `decrementWithMeta` without verifying `quantity_available` or location holds; sets OMS to `ready_to_ship` |
| **Babel Express Capabilities** | `backend/src/modules/shipping/providers/babel-express/` | **VERIFIED** | Supports `createShipment`, `calculatePrice`, tracking. Has NO reactivation or resume endpoints. |
| **Sila SY Capabilities** | `backend/src/modules/shipping/providers/sila-sy/` | **VERIFIED** | Supports `createShipment`, `cancelShipment` (with courier confirmation), tracking. Has NO reactivation endpoint. |
| **Webhook Out-of-Order Handling** | `backend/src/modules/shipping/shipping-tracking.service.ts:284` | **VERIFIED** | Rank check (`currentRank >= 4 || currentOmsStatus === 'delivered' || currentOmsStatus === 'returned'`) prevents stale webhooks from regressing states. |

---

## 3. Status Mapping Plan

### 3.1 Status Matrix & Mappings

The internal enum `OmsReturnStatus` does NOT need database migration. The representation in UI and filters must be mapped cleanly across Arabic and English:

| Internal DB Status (`OmsReturn.status`) | Corresponding `OmsOrder.status` | Display Label (Arabic) | Display Label (English) | Badge Tone |
| :--- | :--- | :--- | :--- | :--- |
| `requested` | `return_pending_receipt` | **مرتجع بانتظار الاستلام** | Return Pending Receipt | `warning` |
| `approved` | `return_pending_receipt` | **معتمد (بانتظار الاستلام)** | Approved (Awaiting Receipt) | `brand` |
| `completed` | `returned` | **مرتجع مستلم** | Return Received | `success` |
| `cancelled` | *(order remains prior state / rolled back)* | **ملغي** | Cancelled | `neutral` |
| `rejected` | *(order remains prior state)* | **مرفوض** | Rejected | `danger` |

### 3.2 Legacy Compatibility
- Historical returns with status `completed` represent verified receipt into the warehouse. They must display as **مرتجع مستلم** (Return Received).
- Historical returns with status `requested` or `approved` represent pending returns. They must display as **مرتجع بانتظار الاستلام** (Return Pending Receipt).
- Unrelated completed orders (e.g., standard outbound orders without returns) are unaffected because this mapping is scoped specifically to `OmsReturn` and the OMS Returns page.

### 3.3 UI Implementation Targets
1. `frontend/src/pages/OmsCodReturnsPages.tsx`:
   - Replace `{row.status.replace(/_/g, ' ')}` with a helper `getOmsReturnStatusBadge(row.status, isArabic)` or an enriched `<StatusBadge status={mappedKey} />`.
   - Update `RETURN_STATUS_OPTIONS` with bilingual labels matching the exact Arabic and English requirements.
   - Update table actions: for `completed` returns, show a status tag **مرتجع مستلم** / **Return Received**; for eligible users, provide a secondary **Rollback Return** action button.
2. `frontend/src/pages/OmsReturnDetailPage.tsx`:
   - Align header status display with the same unified mapping.
   - Add Rollback Return action with confirmation dialog.

---

## 4. Rollback Business Rules

### 4.1 Eligibility Criteria (Pre-execution validation)
A return is eligible for Rollback if and only if ALL conditions pass:
1. **Return Status**: Must be `completed`. If `requested`, `approved`, or `cancelled`, reject with error:
   *"Only confirmed-received returns can be rolled back."*
2. **Actor Authorization**: User must have `super_admin` or `warehouse_manager` role. Client roles (`client_admin`, `client_staff`) are strictly denied with `403 Forbidden`.
3. **Idempotency Guard**: No compensating ledger movement with key starting with `return:rollback:<omsReturnId>:` already exists.
4. **Physical Stock Integrity (The Critical Safety Check)**:
   - Identify each item received under this return from `inventory_ledger` where `reference_type = return_order` and `reference_id = return.id` and `movement_type = return_receive`.
   - For each received line: check `current_stock` at the exact `location_id` (typically the `Returns` quarantine location):
     $$\text{quantity\_on\_hand} - \text{quantity\_reserved} \ge \text{quantity\_received}$$
   - If stock was transferred out of `Returns` (e.g., put away to sellable racks), picked, reserved for another order, or consumed, reject rollback immediately with:
     *"Cannot rollback return: Inventory of [SKU] has already been transferred, reserved, or consumed from the Returns location."*
5. **Order Association**: Linked `OmsOrder` must exist and be currently in `returned` status.

### 4.2 State Transitions upon Successful Rollback
1. **OmsReturn**: Transitions from `completed` to `cancelled`. `notes` appended with:
   `"Rollback executed on <ISO-Date> by <User-Email>: Inventory reversed and order shipping workflow restored."`
2. **OmsOrder**:
   - Status transitions from `returned` to `out_for_delivery` (if the original carrier shipment is still valid/active or re-dispatchable) or `ready_to_ship` (if the original shipment was cancelled/superseded).
   - `returnedAt` reset to `null`.
3. **OutboundOrder** (if linked):
   - Status updated to match (`out_for_delivery` or `ready_to_ship`), `returnedAt` reset to `null`.
4. **Audit Trail**:
   - Insert `OmsOrderEvent` with `eventType: 'return.rollback_completed'` containing full before/after snapshots, user ID, and compensating ledger references.

---

## 5. Inventory Reversal Algorithm

```
                  ┌─────────────────────────────────────┐
                  │ Admin initiates Rollback for Return │
                  └──────────────────┬──────────────────┘
                                     │
                    [Check Return Status == completed]
                                     │
                    [Check Idempotency: Not rolled back]
                                     │
           [Query inventory_ledger WHERE ref_id = return.id]
                                     │
      ┌──────────────────────────────┴──────────────────────────────┐
      │ For each return_receive ledger movement:                    │
      │ 1. Lock current_stock row FOR UPDATE                        │
      │ 2. Verify: on_hand - reserved >= received_quantity          │
      └──────────────────────────────┬──────────────────────────────┘
                                     │
                         All lines have stock?
                                    / \
                                   /   \
                             NO   /     \   YES
                                 /       \
     ┌───────────────────────────┐       ┌─────────────────────────────────────┐
     │ ABORT Transaction         │       │ IN ATOMIC TRANSACTION:              │
     │ Throw BadRequestException │       │ 1. Decrement current_stock on_hand  │
     │ Explaining exact SKU gap  │       │ 2. Insert compensating ledger row:  │
     └───────────────────────────┘       │    movement_type: adjustment_neg    │
                                         │    idempotency_key: return:rollback │
                                         │ 3. Update OmsReturn -> cancelled    │
                                         │ 4. Update OmsOrder -> out_for_deliv │
                                         │ 5. Insert OmsOrderEvent audit       │
                                         └─────────────────────────────────────┘
```

### Detailed Algorithm Steps:
1. **Find Receipt Movements**:
   ```typescript
   const receiptMovements = await tx.inventoryLedger.findMany({
     where: {
       referenceType: LedgerRefType.return_order,
       referenceId: omsReturn.id,
       movementType: MovementType.return_receive,
     },
   });
   ```
2. **Atomic Row Locks & Validation**:
   - For each movement, acquire an exclusive row lock on `current_stock` using `SELECT quantity_on_hand, quantity_reserved FROM current_stock ... FOR UPDATE`.
   - Calculate available unreserved quantity: `available = quantity_on_hand - quantity_reserved`.
   - If `available < movement.quantity`, throw `BadRequestException(`Cannot rollback return: SKU ${product.sku} has insufficient available stock in Returns location (required ${movement.quantity}, available ${available}).`)`.
3. **Compensating Ledger Movements**:
   - Execute `decrementWithMeta` against `current_stock` for the exact received quantity and location.
   - Insert compensating entry into `inventory_ledger` via `LedgerIdempotencyService.appendIfAbsent`:
     - `idempotencyKey`: `return:rollback:${omsReturn.id}:${movement.id}`
     - `movementType`: `MovementType.adjustment_negative`
     - `fromLocationId`: `movement.toLocationId`
     - `toLocationId`: `null`
     - `quantity`: `movement.quantity`
     - `referenceType`: `LedgerRefType.return_order`
     - `referenceId`: `omsReturn.id`
     - `operatorId`: `user.id`
     - `notes`: `Compensating reversal for return receipt ${movement.id}`

---

## 6. Carrier and Shipment Consistency (Babel & Sila)

### 6.1 Provider Realities
- **Babel Express**: No cancellation or reactivation endpoints exist in their public API. Shipments once booked remain on Babel's ledger.
- **Sila SY**: Provides `cancelShipment` which triggers courier confirmation. Sila does NOT have an `un-cancel` or `resume` API.

### 6.2 Three Operational Scenarios

#### Scenario 1: Original Shipment Still Active at Carrier
- Carrier status is still `out_for_delivery` or `in_transit` (or local `CarrierShipment.status = created` and never cancelled).
- **Result**:
  - `OmsOrder.status` restored to `out_for_delivery`.
  - Existing AWB, tracking number, and carrier assignment remain linked and active.
  - UI message: *"Return receipt rolled back. Order restored to Out for Delivery with active shipment [AWB]."*

#### Scenario 2: Original Shipment Was Cancelled or Superseded
- Local `CarrierShipment` is marked `cancelled` or `superseded` (e.g. via Sila cancel confirmation).
- **Result**:
  - We must NOT falsely claim the carrier shipment is live.
  - Local inventory is reversed safely.
  - `OmsOrder.status` is set to `ready_to_ship` (or `out_for_delivery` with an explicit flag `carrier_reshipment_required: true`).
  - `OmsOrderEvent` records that shipment was previously cancelled and requires re-dispatching with the carrier.
  - UI message: *"Return receipt rolled back and stock reversed. The carrier shipment was previously cancelled; order status is restored to Ready for Shipping to generate a new shipment."*

#### Scenario 3: Late Carrier Webhooks
- Tracking webhook listener (`ShippingTrackingService.processTrackingEvent`) already implements rank checks:
  - If a webhook reports `returned_to_sender` for a shipment that was already rolled back, the existing `ignored_superseded_shipment` guard suppresses the transition.
  - Add explicit guard: check if return associated with the shipment was rolled back; if so, log `carrier.late_webhook_ignored` and reject order regression to `returned`.

---

## 7. Exact Implementation Checklist

### Backend Tasks

1. **Add Returns Service Rollback Method**
   - **File**: `backend/src/modules/oms-returns/oms-returns.service.ts`
   - **Method**: `rollbackReturn(id: string, user: AuthPrincipal)`
   - **Responsibilities**:
     - Enforce `super_admin` or `warehouse_manager` / `warehouse_staff` authorization.
     - Validate return is `completed`.
     - Inspect `inventory_ledger` movements for `referenceId = return.id`.
     - Perform atomic lock and availability verification on `current_stock`.
     - Append compensating ledger rows (`return:rollback:...`).
     - Update `OmsReturn.status = cancelled`.
     - Restore `OmsOrder.status` (`out_for_delivery` if shipment valid, else `ready_to_ship`).
     - Emit realtime update and log `OmsOrderEvent`.

2. **Add Endpoint to Controller**
   - **File**: `backend/src/modules/oms-returns/oms-returns.controller.ts`
   - **Action**: Add `@Post(':id/rollback')` route calling `returns.rollbackReturn(id, user)`.

3. **Late Webhook Invalidation Guard**
   - **File**: `backend/src/modules/shipping/shipping-tracking.service.ts`
   - **Method**: `processTrackingEvent`
   - **Action**: Check if the order's return was rolled back before accepting delayed `returned` status.

### Frontend Tasks

4. **Add Rollback API Call**
   - **File**: `frontend/src/api/oms.ts`
   - **Action**: In `OmsReturnsApi`, add `rollbackReturn(id: string): Promise<OmsReturn>`.

5. **Update Returns Table & Status Badges**
   - **File**: `frontend/src/pages/OmsCodReturnsPages.tsx`
   - **Tasks**:
     - Update `RETURN_STATUS_OPTIONS` with bilingual labels:
       - `requested` → English: `Return Pending Receipt`, Arabic: `مرتجع بانتظار الاستلام`
       - `completed` → English: `Return Received`, Arabic: `مرتجع مستلم`
       - `cancelled` → English: `Cancelled`, Arabic: `ملغي`
       - `rejected` → English: `Rejected`, Arabic: `مرفوض`
       - `approved` → English: `Approved`, Arabic: `معتمد`
     - Replace raw status string in table row with styled StatusBadge / bilingual translation helper.
     - In table action column for `completed` returns, add a "Rollback" button (with confirmation modal) for authorized users.

6. **Update Return Detail Page**
   - **File**: `frontend/src/pages/OmsReturnDetailPage.tsx`
   - **Tasks**:
     - Render status banner using unified Arabic/English labels (**مرتجع بانتظار الاستلام** / **مرتجع مستلم**).
     - Add `Rollback Return` button when `omsReturn.status === 'completed'`.
     - Display confirmation modal with warning about inventory reversal and order restoration.

---

## 8. Database and Migration Plan

- **Migrations Required**: **NONE**.
- **Reason**:
  - `OmsReturnStatus` already contains `requested`, `approved`, `completed`, and `cancelled`.
  - `OmsOrderStatus` already contains `return_pending_receipt`, `returned`, `out_for_delivery`, and `ready_to_ship`.
  - `MovementType` already contains `return_receive` and `adjustment_negative`.
  - `LedgerRefType` already contains `return_order`.
- **Zero Schema Risk**: Existing enum values and partitioned ledger tables completely support this workflow without DDL changes.

---

## 9. Test Plan

### Unit & Integration Tests (Mocked Providers)
1. **Status Label Unit Tests** (`frontend/src/lib/statusMeta.unit.spec.ts` or new spec):
   - Assert `statusLabel('requested', true)` returns `'مرتجع بانتظار الاستلام'`.
   - Assert `statusLabel('completed', true)` returns `'مرتجع مستلم'`.
   - Assert `statusLabel('cancelled', true)` returns `'ملغي'`.
2. **Eligible Rollback Happy Path**:
   - Create order, outbound, and confirm return receipt. Verify inventory added to `Returns` location.
   - Invoke `rollbackReturn`.
   - Verify:
     - `current_stock` decreased by exact receipt quantity.
     - Compensating `inventory_ledger` row inserted with `adjustment_negative`.
     - Original ledger row intact.
     - `OmsReturn.status === 'cancelled'`.
     - `OmsOrder.status === 'out_for_delivery'` (or `ready_to_ship`).
3. **Insufficient Stock Rejection**:
   - Confirm return receipt (qty = 5).
   - Simulate transfer or consumption so `current_stock` has only 2 available.
   - Invoke `rollbackReturn`.
   - Verify transaction aborts with `BadRequestException`, no ledger row created, status remains `completed`.
4. **Idempotency & Concurrency Test**:
   - Send two concurrent rollback calls for the same return ID.
   - Verify one succeeds and the other is safely rejected without double-deducting stock.
5. **Unauthorized Rejection**:
   - Call rollback with `client_admin` principal. Verify `403 Forbidden`.

---

## 10. Staging Verification Checklist

- [ ] Open `/oms/returns` in Arabic: verify status badges show **مرتجع بانتظار الاستلام**, **مرتجع مستلم**, and **ملغي**.
- [ ] Verify filter dropdown lists the Arabic labels correctly and filters table records accurately.
- [ ] Toggle language to English: verify labels show **Return Pending Receipt**, **Return Received**, and **Cancelled**.
- [ ] Complete a test return on Staging: verify inventory increases in `Returns` location.
- [ ] Click **Rollback Return** on the completed return:
  - [ ] Confirmation prompt appears.
  - [ ] Upon confirmation, success toast displays.
  - [ ] `current_stock` decreases back to original level.
  - [ ] `inventory_ledger` shows compensating `adjustment_negative` movement.
  - [ ] OMS order shows restored status.
- [ ] Attempt rollback on a return whose stock was transferred out: verify clear error message blocks the action.

---

## 11. Risks and Unresolved Questions

1. **Carrier Reactivation**:
   - *Confirmed Limitation*: Neither Babel nor Sila APIs support shipment reactivation. If the courier had marked the shipment cancelled on their side, a physical re-delivery will require issuing a new waybill/shipment.
2. **COD Adjustment Rollback**:
   - If a COD adjustment was applied during return receipt (`codRecords.markReturnedForOrder`), the rollback must restore the COD record to its active collectable state or flag finance review.

---

## 12. Handoff Instructions for Sonnet / Flash

```markdown
### EXECUTION DIRECTIVE:
1. Do NOT run database migrations.
2. Implement backend endpoint `POST /oms/returns/:id/rollback` in `oms-returns.service.ts` and `oms-returns.controller.ts`.
3. Follow the inventory reversal algorithm in Section 5 strictly (enforce `FOR UPDATE` lock, verify `on_hand - reserved >= received_quantity`, write compensating `adjustment_negative` ledger entry with idempotency key `return:rollback:...`).
4. Update frontend labels in `frontend/src/pages/OmsCodReturnsPages.tsx` and `frontend/src/pages/OmsReturnDetailPage.tsx` using the exact labels in Section 3.1.
5. Add Rollback Return UI button with confirmation modal for authorized roles.
6. Run unit and integration tests to confirm zero regressions.
```
