# 06 — OMS Workflow (Online / Ecommerce Orders)

**Confidence:** High for client create → confirm → admin approve → processing → WMS sync → mark delivered. Medium for legacy status labels and COD remittance sub-states.

---

## Purpose

OMS (shown to clients as **Online orders**) manages the **commercial** lifecycle of ecommerce shipments: confirmation, admin approval, fulfillment tracking, delivery outcome, COD, and returns.

Warehouse physical work happens on the linked **Outbound** order after approval.

---

## Actors

| Actor | What they do |
|-------|----------------|
| Client | Create, confirm, cancel (early), create return after delivered |
| Admin / Manager / Finance (nav) | Approve/reject, shipping fee, mark delivered / failed / revert |
| Warehouse | Fulfill via outbound/tasks (not via client UI) |

---

## Commercial statuses (user-facing)

| Label | Typical meaning |
|-------|-----------------|
| Waiting for Confirmation | Created; awaiting client confirm |
| Confirmed — Waiting for Admin Approval | Client confirmed; warehouse must approve |
| Processing | Approved; outbound exists; warehouse working |
| Ready to Ship / Ready for Shipping | Outbound ready for dispatch |
| Out for Delivery | In transit (commercial / synced) |
| Delivered | Admin marked delivered |
| Failed Delivery | Delivery failed |
| Returned | Return completed against order |
| Cancelled | Cancelled / rejected path |
| Legacy: … | Older status values still displayed |

### Admin create shortcut

Admin creating an OMS order with fulfillment provisioned may land directly in **Processing** with an outbound draft (skips client confirmation).

### Bulk import

Imported orders often enter **Confirmed — Waiting for Admin Approval** without outbound until approved.

---

## Workflow 1 — Client happy path

### Preconditions

- Operational billing account
- Products with available stock
- Valid Syria address hierarchy + **map pin** on create

### Steps

1. Client → **Online orders** → **Create order** / New.
2. Fill recipient, cascading address, street, **place map pin**, ship date, payment, lines.
3. **Submit for approval**.
4. Order appears as **Waiting for Confirmation**.
5. Client opens detail → **Confirm order**.
6. Status → **Confirmed — Waiting for Admin Approval**.
7. Admin opens OMS order → reviews; may set shipping fee; **Approve**.
8. If shipping/delivery info incomplete (`needsInformation`), approve is blocked with incomplete-order message.
9. On approve: status **Processing**; linked outbound **Draft** created; stock re-checked.
10. Warehouse fulfills outbound (see `05-OUTBOUND-WORKFLOW.md`).
11. As outbound reaches ready_to_ship / shipped, OMS labels update accordingly.
12. Admin **Mark delivered** when appropriate → **Delivered**.
13. Optional COD progression on Cash on delivery / admin COD.
14. Optional client **Create return** after Delivered.

### Expected result

End state **Delivered** (or Returned / Failed Delivery / Cancelled depending on path). Inventory reduced via outbound dispatch. Client sees tracking statuses on detail.

---

## Workflow 2 — Client cancel (early)

### Allowed when

Waiting for Confirmation, Confirmed — Waiting for Admin Approval (and legacy pending approval).

### Steps

1. Open detail → **Cancel order**.
2. Confirm if prompted.
3. Status → **Cancelled**.

### Not allowed when

After admin approval / processing — cancel controls hidden for client; only admin can cancel mid-fulfillment.

---

## Workflow 3 — Admin reject

From pre-fulfillment waiting states, admin **Reject** cancels the commercial order (stores rejection reason fields). User sees **Cancelled** (system may also have a `rejected` enum historically).

**Confidence:** High that reject ends the order; Medium for exact badge text Rejected vs Cancelled.

---

## Workflow 4 — Delivery outcomes

| Action | From | To |
|--------|------|-----|
| Mark delivered | Shipped / Out for Delivery | Delivered |
| Revert delivery | Delivered | Shipped (reason required) |
| Failed delivery | Ready to ship / Shipped / Out for Delivery | Failed Delivery |

OMS **Delivered** is a commercial action — it is **not** automatically set merely because warehouse outbound shipped.

---

## Payment methods

COD · Prepaid · Credit

COD orders interact with COD records / **Cash on delivery** (client) and **COD** (admin OMS).

COD record statuses (admin): Pending · Available · Paid out · Returned  
Client my-profits filters: Pending · Collected · Remitted · Settled · Returned (labels).

---

## Create form validation (client)

| Rule | Behavior |
|------|----------|
| Name letters/spaces only | Block / message |
| Valid phone for country | Block / message |
| Ship date ≥ today | Block |
| Map pin required | Submit blocked without lat/lng |
| Whole-number qty | Block decimals |
| Stock availability | Insufficient stock error with SKU |

Admin create form may include additional shipping configuration fields (method, provider, packing flag, fees).

---

## Map behavior (client create)

- Blue hollow circle = approximate selected area guide; should move when governorate/city/neighborhood change.
- Click map to place pin; drag to adjust; Remove Pin clears coordinates.
- Changing address selectors clears an existing pin.

See also recent staging fixes for circle recenter and submit fields.

---

## Incomplete shipping / needs information

Orders imported or created without complete delivery info may show **Incomplete Order**. Admin cannot approve until shipping/delivery information is completed.

---

## Side effects summary

| Event | Side effect |
|-------|-------------|
| Client create | OMS only; no outbound |
| Client confirm | Wait admin |
| Admin approve | Outbound draft + processing |
| Outbound progress | OMS ready_to_ship / shipped sync |
| Mark delivered | Commercial delivered; COD may become actionable |
| Return complete | OMS may become Returned |

---

## Negative tests

| Attempt | Expected |
|---------|----------|
| Submit without map pin | Blocked |
| Approve incomplete order | Error about incomplete shipping/delivery |
| Client cancel after processing | No button / rejected |
| Insufficient stock on approve | Error naming SKU |
| Mark delivered from Waiting for Confirmation | Action not available |

---

## Cross-module

Client Online order → Admin OMS → Outbound → Tasks → Inventory → Shipping → Documents → COD → Returns → Notifications → Billing
