# 05 — Outbound Workflow

**Confidence:** High for staged admin flow including shipping method gate. Medium for every filter label vs rare statuses (`allocated`, `externally_fulfilled`, etc.).

---

## Purpose

Outbound orders ship goods out of the warehouse for a client (manual warehouse order or OMS-provisioned fulfillment).

---

## Actors

| Actor | Actions |
|-------|---------|
| Client | Creates outbound request; views collapsed statuses |
| Admin / Manager | Approves, edits shipping, drives stages |
| Operator | Executes pick / pack / dispatch tasks |
| Finance | View (nav) |

---

## Statuses (admin list / detail)

Common filter / display labels:

| Label / status | Meaning |
|----------------|---------|
| Draft | Plan not released |
| Pending approval | Client-submitted |
| Pending stock | Waiting stock |
| Confirmed | Confirmed |
| Picking | Pick in progress |
| Packing | Pack in progress |
| Waiting for Shipping Method | Must choose Manual vs Shipping Company |
| Waiting for Shipping Details | Carrier/manual details |
| Waiting for Dispatch / Ready to ship | Ready for dispatch |
| Shipped | Dispatched |
| Fulfilled outside warehouse | External fulfillment |
| Cancelled | Cancelled |

Also present in the system (may appear on detail): allocated, out_for_delivery, delivered, returned.

**Confidence:** High for the staged path below; Medium that every enum value appears in filters.

### Client-facing collapsed labels

**Waiting for approval · In progress · Shipped · Cancelled**  
(`shipped` and `delivered` both show as **Shipped** on client).

---

## Workflow A — Client creates outbound

### Preconditions

- Account operational
- Available stock for selected products

### Steps

1. Client → **Outbound** → **New outbound order**.
2. Enter **Destination**, **Required ship date** (≥ today).
3. Optional Carrier, Notes.
4. Add product lines; quantity capped by available stock.
5. **Submit for approval**.

### Expected result

- Status **Waiting for approval** on client.
- Admin sees pending outbound; notification type `admin_outbound_pending_approval` may appear.
- Execution waits for admin approve.

### Failure cases

- Qty above available → blocked / error
- Missing destination or date → validation
- Restricted account → create disabled

---

## Workflow B — OMS-provisioned outbound

When an OMS order is admin-approved (or admin-created with fulfillment):

1. Linked outbound is created in **Draft**.
2. Admin continues outbound stages like a normal warehouse outbound.
3. OMS commercial status stays **Processing** until later shipping sync points.

See `06-OMS-WORKFLOW.md`.

---

## Workflow C — Admin fulfillment stages (happy path)

### Preconditions

- Outbound in draft / pending approval / allocated as applicable
- Stock sufficient when required

### Steps

1. **Approve** waiting outbound → moves into **Picking** (task-oriented; no premature stock deduct at approve when task-only flows are enabled).
2. Complete **picking** →  
   - If packing not required → **Waiting for Shipping Method**  
   - Else → **Packing**
3. Complete **packing** (when required) → **Waiting for Shipping Method**.
4. **Select Shipping Method**:
   - **Manual**, or
   - **Shipping Company** (requires provider selection)
5. Status → **Waiting for Shipping Details**.
6. Fill shipping details (weight, volume, package type, contents, delivery/pickup type, payer, phone country, receiver lat/lng as required for carrier).
7. Optional **Send Shipment** for carrier (status stays on shipping details until success rules satisfied).
8. **Mark Shipping Details Complete** → **Ready to ship** (Waiting for Dispatch).
9. Complete **dispatch** → **Shipped**.
10. Client may see **Shipped** and notification `outbound_order_completed` (copy may say shipped).

### State machine (simplified)

```text
draft / pending_approval
        ↓ Approve
     picking
        ↓ Complete pick
 packing (optional)
        ↓
 waiting_for_shipping_method
        ↓ Select method
 waiting_for_shipping_details
        ↓ Mark details complete
 ready_to_ship
        ↓ Dispatch
     shipped
```

### Side effects

- Tasks: pick, pack, shipping_details, dispatch
- Inventory reserved then fulfilled / decremented at dispatch
- Delivery note PDF generation around dispatch
- OMS sync: ready_to_ship / shipped reflected on linked OMS order

### Failure cases (examples)

- Select method outside waiting_for_shipping_method → error
- Carrier without provider → *shippingProviderCode is required…*
- Mark details complete before successful Send Shipment (carrier) → blocked with message about Send Shipment
- Packed qty > picked qty → error
- Ship qty mismatch → error

---

## Bulk shipping / labels

Admin outbound list / shipping flows may offer **Print / Download Labels** for carrier processing. Progress may update live (realtime).

**Confidence:** Medium for exact entry points on every screen.

---

## Negative / edge tests

| Attempt | Expected |
|---------|----------|
| Skip shipping method stage | Cannot reach dispatch without method selection |
| Client edits after submit | No client edit on detail |
| Cancel shipped order | Should be blocked or tightly controlled — **NEEDS VERIFICATION** exact UI |
| Change method after ready_to_ship | Shipping identity locked after certain statuses |
| Double-complete dispatch | Idempotent or error — **NEEDS VERIFICATION** |

---

## Cross-module

Outbound → Tasks → Inventory → Shipping Companies → Documents (DN) → OMS status sync → Notifications → Billing usage
