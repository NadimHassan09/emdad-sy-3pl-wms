# 21 — End-to-End Invariants

**Staging only.** Critical journeys and what must remain true from start to finish.

---

## E2E-OMS-FULFILL — Client Online Order to Delivered

### Starting conditions
- Staging client `client_admin` (or staff) with `operationalAllowed=true`.
- Products with available stock ≥ ordered qty.
- Valid Syria address + map pin on create.

### Actions
1. Client creates online order → Waiting for Confirmation.
2. Client confirms → Confirmed — Waiting for Admin Approval.
3. Admin sets shipping fee if needed → Approve.
4. Admin approves linked outbound → Picking … through shipping method/details → Dispatch → Shipped.
5. Admin Mark delivered on OMS.

### Expected states
| Step | OMS | Outbound | Inventory |
|------|-----|----------|-----------|
| After client create | waiting_for_confirmation | none | available unchanged (no reserve on create) |
| After client confirm | confirmed_waiting_for_admin_approval | none | unchanged |
| After admin approve | processing | draft | checked; maybe reserved if allocate-on-create |
| After WH approve | processing | picking | maybe reserved |
| After pick complete | processing | packing or waiting_for_shipping_method | reserved; picked set |
| After ship | shipped (synced) | shipped | on-hand decreased |
| After mark delivered | delivered | may still be shipped | unchanged by mark delivered |

### Expected data changes
- Subtotal = linesSum + shippingFee.
- COD amount = subtotal if COD and not overridden.
- One outbound linked.

### Expected financial effects
- Shipping fee only from admin.
- COD record generated on deliver for non-zero COD.
- Later billing: shipped outbound increments outbound fee count when `shippedAt` in cycle window.

### Expected documents
- DN after dispatch (when generation succeeds).

### Expected notifications
- Admin may see pending-related notices earlier; client may see confirmations/completions.

### Final state
OMS Delivered; stock reduced by shipped qty; COD pending/ok if COD.

### Forbidden final states
- OMS Delivered with never-approved outbound path from this journey.
- Negative available.
- Client shipping fee on order.
- Second outbound from double approve.

### Confidence
High (allocate-on-create reservation timing Medium).

---

## E2E-INBOUND-STOCK — Client Inbound to Sellable Stock

### Starting conditions
Operational client; product exists.

### Actions
Client submit inbound → Admin approve → Receive → Putaway → Completed.

### Expected states
Pending approval → in progress → completed.

### Expected inventory effects
After receive: on-hand↑ awaiting_putaway. After putaway: available↑.

### Expected financial effects
Completed inbound counted in billing draft inbound line for cycle window.

### Forbidden final states
Available includes awaiting_putaway as pickable; receive >110% expected.

### Confidence
High

---

## E2E-RETURN — Delivered OMS to Returned

### Starting conditions
OMS Delivered; returnable qty > 0.

### Actions
Client create OMS return → Admin approve → WH process → Complete.

### Expected states
Return Requested → Approved → Completed; OMS may become Returned.

### Expected inventory effects
Per disposition (restock vs scrap/quarantine).

### Forbidden final states
Return qty > remaining; return against non-delivered OMS (client UI).

### Confidence
High for caps; Medium for disposition stock status details.

---

## E2E-BILLING-RESTRICT — Restriction Blocks Ops

### Starting conditions
Company forced to restricted / no live cycle (admin/billing lifecycle).

### Actions
Client attempts New online order / inbound / outbound / product.

### Expected states
Banner restricted/no plan; create controls disabled.

### Expected data changes
No new orders from UI. Backend blocks inbound/outbound/product create.

### Forbidden final states
UI allows create while access API says operationalAllowed=false.

### Note
OMS/returns API may still accept creates — if observed, log as consistency gap (BR-BIL-003).

### Confidence
High

---

## E2E-IDEMPOTENCY — Double Approve / Double Deliver / Double Dispatch

### Actions
Repeat Approve OMS; Mark delivered; Complete pick/dispatch.

### Expected
Second attempt no-ops or returns same entity; no second outbound; no second inventory decrement for idempotent dispatch; COD generate retries only if prior generation not ok.

### Forbidden
Duplicate outbounds; double on-hand decrement from one ship.

### Confidence
High

---

## Journey Checklist for Kane

For each E2E run record:

1. Initial stock snapshot (SKU → available/on-hand/reserved).
2. Initial OMS/outbound absence or status.
3. After each major action: statuses + stock + money fields.
4. Final reconciliation against this document’s tables.
5. Evidence screenshots of mismatched pairs.
