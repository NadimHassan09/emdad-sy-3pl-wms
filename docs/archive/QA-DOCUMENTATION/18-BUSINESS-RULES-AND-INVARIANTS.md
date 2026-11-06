# 18 — Business Rules and Invariants

**Environment:** Staging only (`staging-client.emdadsy.com`, `staging-admin.emdadsy.com`).  
**Rule:** Every rule below is backed by implementation. Assumptions are marked **UNKNOWN / NEEDS VERIFICATION**.

Kane must treat these as “what MUST be true,” not only “what the button does.”

---

## Authentication / Authorization

## BR-AUTH-001 — Portal Separation

### Rule
Admin accounts authenticate only on the admin portal; client accounts only on the client portal.

### Source
Separate JWT guards: admin JWT vs `JwtClientAuthGuard`.

### Preconditions
Valid credentials for one portal type.

### Trigger
Login attempt on a portal.

### Expected Outcome
Success only on the matching portal; failure on the other.

### Invariant
No cross-portal session.

### Negative Case
Admin credentials on client login (and reverse) fail.

### QA Verification
Attempt wrong-portal login; remain on login with error.

### Confidence
High

---

## BR-AUTH-002 — Client Staff Cannot Access Billing / APIs / Product Mutations

### Rule
`client_staff` cannot open Billing, Invoices, or APIs, and cannot create/edit/delete products.

### Source
Client RBAC route groups; product services require `client_admin`.

### QA Verification
As staff, open `/billing`, `/apis`, `/products/new` → deny/redirect; as admin, allowed.

### Confidence
High

---

## BR-AUTH-003 — Role + Status + Billing Gate Combined Actions

### Rule
An action is allowed only if **all** apply: role permission, entity status allows the transition, and (for gated client creates) operational billing is allowed.

### Source
RBAC + status machines + `BillingAccessService.assertOperationalBilling` (inbound/outbound/product create).

### Invariant
Having a role does not override illegal status or billing restriction for gated operations.

### QA Verification
Try approve on wrong status; try create while restricted; try staff billing.

### Confidence
High for listed gates. Medium for OMS/returns API vs UI (see BR-BIL-003).

---

## Orders / OMS

## BR-OMS-001 — Client Create Starts Waiting for Confirmation (No Outbound)

### Rule
Client-created online orders start as **Waiting for Confirmation** and do **not** create an outbound yet.

### Source
`ClientOmsOrdersService.create` → `provisionOutbound: false`; `OmsOrdersService.create` initial status.

### Invariant
After client create: OMS exists; no linked outbound for that create path.

### QA Verification
Create online order → detail shows Waiting for Confirmation; admin outbound list has no linked fulfillment yet.

### Confidence
High

---

## BR-OMS-002 — Admin Approve Requires Complete Shipping Information

### Rule
Admin cannot approve an order flagged incomplete (`needsInformation`).

### Source
`OmsOrdersService.approve` throws when `needsInformation`.

### Negative Case
Visible error: incomplete shipping/delivery information must be completed.

### QA Verification
Import/incomplete order → Approve → blocked; complete info → approve succeeds.

### Confidence
High

---

## BR-OMS-003 — Approve Creates Exactly One Outbound (Idempotent)

### Rule
First successful approve/confirm-to-processing creates linked outbound (Draft) and sets OMS **Processing**. Second approve while already processing with outbound linked is a no-op return.

### Source
`approve` / `confirm` idempotent branches; `createOutboundFromOms` reuses existing link.

### Invariant
One OMS order → at most one provisioned outbound from this path.

### QA Verification
Approve twice → still one outbound; status remains Processing.

### Confidence
High

---

## BR-OMS-004 — Clients Cannot Set Shipping Fee

### Rule
Client create payload does not accept shipping fee; admin sets fee at create/update/approve.

### Source
`CreateClientOmsOrderDto` lacks `shippingFee`; client service comment + omit.

### QA Verification
Client create UI has no shipping-fee field; after admin sets fee, totals reflect it.

### Confidence
High

---

## BR-OMS-005 — Commercial Delivered Is Admin-Only (Not Auto from Warehouse)

### Rule
OMS **Delivered** is set only by admin **Mark delivered** from **Shipped** or **Out for Delivery**. Outbound status `delivered` does **not** map into OMS delivered.

### Source
`oms-order-transitions` `mark_delivered`; `mapOutboundStatusToOms` returns null for outbound `delivered`.

### Forbidden
OMS Delivered while still Waiting for Confirmation / Waiting Admin Approval / without commercial mark.

### QA Verification
Ship outbound → OMS shows Shipped/Ready path; Delivered only after Mark delivered.

### Confidence
High

---

## BR-OMS-006 — Client Cancel Only Pre-Fulfillment

### Rule
Client may cancel only in Waiting for Confirmation / Confirmed — Waiting for Admin Approval (and legacy pending approval). After Processing, client cancel UI is hidden; admin cancel rules apply.

### Source
`cancel` actor checks; client detail action gating.

### Confidence
High

---

## Outbound

## BR-OUT-001 — Task-Only Happy Path Status Sequence

### Rule
With task-only admin execution, outbound advances:

`draft|pending_approval|allocated` → (approve) → `picking` → (complete pick) → `packing` **or** `waiting_for_shipping_method` → (complete pack if required) → `waiting_for_shipping_method` → (select method) → `waiting_for_shipping_details` → (complete details) → `ready_to_ship` → (dispatch) → `shipped`.

### Source
`outbound-admin-stages.ts`, `outbound.service.ts` stage CTAs.

### Forbidden
Skipping shipping method selection; completing packing when packing not required.

### QA Verification
Drive stages in order; attempt out-of-order CTA → error.

### Confidence
High (assumes staging `TASK_ONLY_FLOWS` enabled — **verify flag** if stages differ).

---

## BR-OUT-002 — Shipping Method Only at Waiting for Shipping Method

### Rule
Selecting Manual / Shipping Company is only valid in `waiting_for_shipping_method`.

### Source
Outbound select shipping method CTA + error string.

### Negative Case
Error referencing current status.

### Confidence
High

---

## BR-OUT-003 — Carrier Complete Details Requires Successful Send Shipment

### Rule
For carrier method, Mark Shipping Details Complete requires a successfully created carrier shipment first.

### Source
Shipping complete gates + messages about Send Shipment.

### Confidence
High

---

## BR-OUT-004 — Cannot Cancel After Shipped

### Rule
Outbound cannot be cancelled once shipped (or already cancelled).

### Source
`outbound.service.ts` cancel guard.

### Confidence
High

---

## BR-OUT-005 — Packed Qty Cannot Exceed Picked Qty

### Rule
Packed quantity must not exceed picked quantity.

### Source
Task/outbound validation: `Packed qty cannot exceed picked qty.`

### Confidence
High

---

## BR-OUT-006 — Ship Qty Must Equal Picked Qty

### Rule
Ship quantity must match picked quantity per line.

### Source
`Ship qty must match picked qty for line …`

### Confidence
High

---

## Inbound

## BR-INB-001 — Client Create Waits for Warehouse Approval

### Rule
Client inbound creates as pending approval; client cannot approve.

### Source
Client create + admin approve stages.

### Confidence
High

---

## BR-INB-002 — Over-Receive Cap 110% (Database)

### Rule
Received quantity cannot exceed **110%** of expected (DB trigger). App messages may also block at 100% on some paths.

### Source
`0_init` migration trigger; `OverReceiveException` message.

### QA Verification
Try receive >110% → failure; note path-dependent 100% vs 110% (**Medium** for which UI path).

### Confidence
High for DB 110%; Medium for which UI path allows 100–110%.

---

## BR-INB-003 — Received Stock Not Pickable Until Putaway

### Rule
Receiving posts stock as awaiting putaway (not available for pick). Putaway makes it available (or quarantined).

### Source
Task inventory effects receive/putaway.

### QA Verification
After receive before putaway, available for OMS/outbound should not include that qty as pickable.

### Confidence
High

---

## Inventory

## BR-INV-001 — Available = On Hand − Reserved

### Rule
`quantity_available` is generated as `quantity_on_hand - quantity_reserved`.

### Source
DB generated column; inventory helpers.

### Invariant
Available cannot exceed on-hand; reserved ≤ on-hand (CHECK constraints).

### QA Verification
On stock screens: Available = On hand − Reserved (within rounding).

### Confidence
High

---

## BR-INV-002 — OMS Stock Check Uses Available Only (No Reserve on Create)

### Rule
Create/confirm/approve check aggregated `available` stock. Client/OMS create does **not** reserve until outbound generation (and then only if allocate-on-create flag is on).

### Source
`assertSufficientStockForLines`; create comment; `ALLOCATE_ON_ORDER_CREATE`.

### QA Verification
After client OMS create, available should not drop solely due to reservation unless outbound+allocate occurred.

### Confidence
High for check-on-create; Medium for whether staging has allocate-on-create enabled.

---

## BR-INV-003 — On-Hand Decrements at Dispatch (Task-Only Path)

### Rule
Under task-only outbound, on-hand (and reserved) decrement when dispatch completes / order ships—not at approve/pick complete.

### Source
`task-inventory-effects` dispatch path; feature-flag comments.

### QA Verification
Record available before approve, after pick, after ship; expect major on-hand drop at ship/dispatch.

### Confidence
High when task-only flows enabled.

---

## BR-INV-004 — On-Hand Cannot Go Negative (DB)

### Rule
Database constraints keep on-hand ≥ 0 and reserved ≥ 0 with reserved ≤ on-hand.

### Source
Stock table CHECKs.

### Negative Case
Operations that would violate fail at persistence.

### Confidence
High

---

## Tasks

## BR-TSK-001 — Completed Task Complete Is Idempotent for Pick/Dispatch

### Rule
Completing an already completed pick/dispatch task is a no-op (idempotent).

### Source
Task inventory effects idempotent flags.

### QA Verification
Complete twice → no second inventory move; no crash.

### Confidence
High for pick/dispatch; Medium for other task types (may require in_progress).

---

## Returns

## BR-RET-001 — OMS Return Cap = Ordered Qty Minus Prior Returns

### Rule
OMS return lines cannot exceed `ordered.requestedQuantity − alreadyReturned`.

### Source
`oms-returns.service.ts` validation message about remaining returnable.

### Confidence
High

---

## BR-RET-002 — WMS Return Cap Uses Picked Qty on Shipped Outbound

### Rule
Warehouse returns against outbound require outbound **shipped**; remaining = pickedQuantity − prior active return expected qtys.

### Source
`return-quantity.validation.ts`.

### Confidence
High

---

## BR-RET-003 — OMS Return Create Requires Delivered Commercial Order

### Rule
Client OMS return create links only to **Delivered** online orders (UI precondition).

### Source
Client create return page filters.

### Confidence
High (UI); backend may have additional checks — Medium if API-only.

---

## Shipping

## BR-SHP-001 — Method/Identity Locked After Ready to Ship

### Rule
Shipping settings are locked after outbound reaches ready_to_ship (and other locked statuses).

### Source
`assertShippingConfigUnlocked` / identity lock sets.

### Confidence
High

---

## BR-SHP-002 — Carrier Envelope Weight Forced to 1 kg at Send/Quote

### Rule
Envelope package type requires weight exactly 1 kg for carrier readiness; may override stored weight at API send.

### Source
`assertCarrierShippingReady` / Babel rules.

### Confidence
High

---

## Billing

## BR-BIL-001 — Operational Billing Required for Client Inbound/Outbound/Product Create

### Rule
If company has no active plan, no live cycle, or blocked company status, `operationalAllowed=false` and those creates are rejected (API) and disabled (UI).

### Source
`BillingAccessService`; client restriction hook; inbound/outbound/product create asserts.

### Invariant
Restricted/no_plan → those creates fail.

### Confidence
High

---

## BR-BIL-002 — Expiring (≤7 Days) Still Allows Operations

### Rule
`accountStatus=expiring` keeps `operationalAllowed=true` (warning only).

### Source
`BillingAccessService` daysRemaining ≤ 7.

### Confidence
High

---

## BR-BIL-003 — OMS/Returns Backend May Not Enforce Billing Gate (UI Does)

### Rule
Client UI disables OMS/returns create when restricted; backend OMS/returns create paths do **not** call `assertOperationalBilling`.

### Source
Billing explore: OMS/returns create lack assert; UI uses `useClientOperationalAccess`.

### QA Verification
Treat UI disable as expected UX. If API create succeeds while UI disabled → document as consistency gap (not assume either is “correct product intent” without product owner).

### Confidence
High that gap exists in code.

---

## BR-BIL-004 — Invoice System Lines Are Subscription + Completed Inbound Count + Shipped Outbound Count

### Rule
Draft cycle recalc builds subscription (qty 1), inbound fee × completed inbound count in window, outbound fee × shipped outbound count in window. Tiered outbound item fees are stored but **not** applied in charge math.

### Source
`billing-invoice-calculation.service.ts`.

### Confidence
High

---

## Documents

## BR-DOC-001 — GRN After Receiving; DN After Dispatch

### Rule
GRN generation is tied to receiving task completion; Delivery Note to dispatch completion path. Generation is idempotent per type/task/language unless force.

### Source
`document-generation.service.ts`; warehouse task completion hooks.

### Confidence
High

---

## Notifications

## BR-NTF-001 — Client Creates Can Notify Admins of Pending Approval

### Rule
Client inbound/outbound pending approval can produce admin in-app notifications.

### Source
Notification creators for `admin_inbound_pending_approval` / `admin_outbound_pending_approval`.

### Confidence
High that types exist; Medium that every staging config always emits them.

---

## Calculations (pointer)

Detailed formulas live in `19-CALCULATIONS-AND-DERIVED-VALUES.md`. Key invariants:

- OMS `subtotal = linesSum + shippingFee` (fee treated as 0 if omitted in math).
- COD default amount = **merchandise `linesSum`** when payment is COD and amount not explicit (shipping fee is client billing, not COD).
- Delivery revert voids/deletes the COD record so it is not stale in portals.
- `discountAmount` on OMS lines is stored but **not** applied to line/subtotal math.
- Invoice `grandTotal = (subtotal − discount) + VAT`.

---

## Cross-module (pointer)

See `20-CROSS-MODULE-INVARIANTS.md` and `21-END-TO-END-INVARIANTS.md`.

---

## Forbidden States (Confirmed)

| ID | Forbidden state | Why |
|----|-----------------|-----|
| FS-001 | OMS **Delivered** without admin mark_delivered from shipped/out_for_delivery | Transition allow-list |
| FS-002 | Select shipping method outside waiting_for_shipping_method | Stage gate |
| FS-003 | Pack when packing not required | Stage gate |
| FS-004 | Packed qty > picked qty | Validation |
| FS-005 | Ship qty ≠ picked qty | Validation |
| FS-006 | Cancel outbound after shipped | Cancel guard |
| FS-007 | Available > on-hand | Generated column / math |
| FS-008 | Client sets shipping fee on create | DTO omission |
| FS-009 | Approve OMS with needsInformation | Approve guard |
| FS-010 | Client cancel after processing | Actor/status rules |
| FS-011 | Receive > 110% expected | DB trigger |
| FS-012 | WMS return when outbound not shipped | Return quota gate |
| FS-013 | OMS return qty > remaining returnable | OMS returns validation |
| FS-014 | Edit shipping after ready_to_ship lock | Shipping lock |

**UNKNOWN:** Whether OMS Delivered + Outbound still Draft can appear due to data bugs — commercial mark_delivered does not require outbound status check in the transition table beyond OMS from shipped/out_for_delivery. Kane should **reconcile** OMS vs outbound after Mark delivered (see cross-module doc).
