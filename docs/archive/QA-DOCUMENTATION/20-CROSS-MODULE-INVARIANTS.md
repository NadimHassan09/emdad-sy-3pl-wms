# 20 — Cross-Module Invariants

**Staging only.** Relationships the implementation establishes between modules. Kane should open multiple screens after an action and reconcile.

---

## OMS ↔ Outbound

### Source Module
OMS (commercial)

### Target Module
Outbound (warehouse)

### Trigger
Admin approve / admin confirm-to-processing / admin create with provisionOutbound.

### Expected Synchronization
- Creates outbound **Draft** linked to OMS.
- Copies destination, lines, money fields, shipping fields as implemented.
- Optional soft-allocate if `ALLOCATE_ON_ORDER_CREATE` enabled.

### Expected State
OMS **Processing**; Outbound **Draft** (until warehouse approve).

### Expected Data Effect
Stock checked; reservation only if allocate flag on.

### Forbidden Inconsistencies
- Two outbounds for one approve path (idempotent createOutbound).
- Client create producing outbound immediately.

### QA Verification
After approve: open OMS detail (Processing + link) and Outbound detail (Draft, same SKUs/qtys).

### Confidence
High

---

## Outbound → OMS Status Sync

### Trigger
Outbound status changes while OMS is in fulfillment (not terminal, not pre-fulfillment).

### Map (exact)
| Outbound | OMS becomes |
|----------|-------------|
| draft … waiting_for_shipping_details (incl. picking/packing/method/details) | processing |
| ready_to_ship | ready_to_ship |
| shipped / out_for_delivery | shipped |
| delivered | **no change** |
| externally_fulfilled | **no change** |
| cancelled | cancelled |

Sync will not regress OMS rank (processing < ready_to_ship < shipped).

### Forbidden Inconsistencies
- Expecting OMS Delivered solely because warehouse finished (must Mark delivered).
- OMS still Waiting for Confirmation while outbound exists from approve path.

### QA Verification
After each outbound stage, refresh OMS detail and compare to map.

### Confidence
High

---

## Outbound ↔ Tasks ↔ Inventory

### Trigger
Approve outbound → pick/pack/shipping_details/dispatch tasks; task completes.

### Expected Synchronization
| Stage | Inventory |
|-------|-----------|
| Approve (task-only) | Optional soft reserve; no on-hand deduct |
| Pick start | Reserve / reuse reservations |
| Pick complete | Set picked qty; still reserved |
| Pack complete | No stock move |
| Dispatch complete | On-hand↓ and reserved↓; ship |

### Forbidden Inconsistencies
- Large on-hand drop at approve/pick-complete under task-only path.
- Ship without prior pick quantities.

### QA Verification
Snapshot Available before approve, after pick complete, after ship.

### Confidence
High when task-only flows on.

---

## OMS Delivered ↔ COD ↔ Outbound

### Trigger
Admin Mark delivered on OMS (from shipped/out_for_delivery).

### Expected Synchronization
- OMS → Delivered; COD generation pending/ok for COD payments.
- Outbound status is **not** required to flip to delivered by this method.

### Forbidden Inconsistencies
- COD record amount ≠ OMS codAmount/subtotal rule for non-zero COD.
- Mark delivered from Waiting for Confirmation.

### QA Verification
OMS detail + COD admin/client my-profits + outbound still shipped/ready as applicable.

### Confidence
High

---

## OMS Return ↔ Warehouse Return ↔ Inventory ↔ OMS Returned

### Trigger
Client/admin OMS return → admin approve → WH return receiving/post → complete.

### Expected Synchronization
- OMS return Requested → Approved → Completed.
- Linked OMS order may become **Returned**.
- Restock dispositions increase available; scrap/quarantine do not restock as available.

### Forbidden Inconsistencies
- Return qty > returnable remaining.
- Complete return without respecting disposition.

### QA Verification
OMS order status, return status, inventory before/after restock.

### Confidence
High for qty caps; Medium for every disposition’s exact stock status.

---

## Inbound ↔ Tasks ↔ Inventory ↔ Billing

### Trigger
Approve inbound → receive → putaway → completed.

### Expected Synchronization
- Receive: on-hand up as awaiting_putaway (not pickable).
- Putaway: available (or quarantine).
- Billing: completed inbound counted in cycle draft when `completedAt` in window.

### QA Verification
Stock health after putaway; later billing draft inbound count increments.

### Confidence
High

---

## Client Billing Restriction ↔ Ops Modules

### Trigger
Company restricted / no plan / no live cycle.

### Expected Synchronization
UI disables creates/imports for inbound, outbound, OMS, products, returns.  
Backend enforces for inbound, outbound, product **create**.  
Backend does **not** enforce for OMS/returns create (gap).

### Forbidden Inconsistencies (product intent TBD)
UI says blocked but API still creates OMS/returns — report as **consistency gap** with evidence, Confidence High that gap exists; do not invent which side is “correct.”

### Confidence
High

---

## Documents ↔ Tasks

### Trigger
Receiving task complete → GRN; Dispatch complete → DN.

### Expected Synchronization
PDF creatable/openable for that task/order; idempotent regenerate.

### QA Verification
After receive/dispatch, Contracts or order Documents card shows Create/Open PDF.

### Confidence
High

---

## Notifications ↔ Orders

### Trigger
Client pending inbound/outbound; completions; billing events.

### Expected Synchronization
Admin/client notification inbox entries appear (in-app).

### Confidence
Medium (config may suppress some types).

---

## Reconciliation Checklist (Kane)

After critical actions, compare:

1. OMS status vs Outbound status (sync map).
2. OMS line qty vs Outbound line qty.
3. OMS money vs COD amount (if COD delivered).
4. Inventory available vs prior snapshot + expected stage effect.
5. Billing draft counts vs completed/shipped orders in cycle (admin).
6. Document presence vs completed receiving/dispatch.
