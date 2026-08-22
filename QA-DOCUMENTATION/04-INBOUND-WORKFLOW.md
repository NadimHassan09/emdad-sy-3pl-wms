# 04 — Inbound Workflow

**Confidence:** High for client submit → admin approve → receiving → putaway → completed. Medium for exact button labels on every stage (Approve / Release to workers / Complete receiving / Complete putaway — verify on staging UI).

---

## Purpose

Inbound orders bring client goods into the warehouse: plan → approve → receive → put away → complete. Stock becomes available after putaway completes (task/inventory effects).

---

## Actors

| Actor | Role in inbound |
|-------|-----------------|
| Client (`client_admin` / `client_staff`) | Creates inbound; waits for warehouse |
| Admin (`super_admin` / `wh_manager`; finance can view) | Approves and drives stages |
| Operator | May execute receiving / putaway tasks |

---

## Statuses (admin-visible)

| Status | Meaning |
|--------|---------|
| Draft | Admin-created draft plan |
| Pending approval | Client-submitted waiting warehouse |
| Confirmed | Confirmed plan |
| In progress | Active receiving/putaway |
| Partially received | Partial progress |
| Completed | Finished |
| Cancelled | Cancelled |

### Client-facing collapsed labels

**Waiting for approval · In progress · Completed · Cancelled**  
(draft / confirmed / in_progress / partially_received collapse into In progress on client).

---

## Workflow A — Client creates inbound

### Preconditions

- Client account not restricted / has plan
- At least one product exists for the company
- User can open Client → Inbound → New inbound

### Steps

1. Open **Inbound** → **New inbound order**.
2. Enter **Expected arrival date** (today or later).
3. Optional **Notes**.
4. Add lines: Product + Quantity (positive whole numbers; one product per line).
5. Click **Submit for approval**.
6. System validates and creates the order.

### Expected result

- Order appears in client inbound list as **Waiting for approval**.
- Admin receives / sees pending inbound (list + possibly notification `admin_inbound_pending_approval`).
- Client **cannot** approve or advance warehouse stages.

### Failure cases

- Missing date / lines → validation prevents submit
- Restricted account → create disabled
- Invalid quantities → error feedback

---

## Workflow B — Admin creates / edits inbound

### Starting point

Admin → **Inbound** → **+ New inbound** (or edit existing plan when allowed).

### Typical actions on list

- Import, Export CSV
- Open detail
- Cancel / Delete when permitted by status (**verify** which statuses allow delete)

### Detail workspace actions (common)

- **Print instructions**
- **Save plan**
- **Approve** / **Release to workers**
- Stage complete CTAs for receiving / putaway
- Documents: **Create PDF** / **Open PDF** (GRN) when eligible

---

## Workflow C — Admin approve → warehouse complete

### Preconditions

- Order in Draft or Pending approval (or equivalent waiting state)
- Plan lines valid

### Steps (happy path)

1. Admin opens inbound detail.
2. Reviews lines / plan; saves if needed.
3. Approves / releases to workers.
4. Status becomes **In progress**; a **Receiving** task is available.
5. Receiving is executed (task UI or admin stage complete).
6. Putaway is completed.
7. Order status → **Completed**.
8. Client may see **Completed** and receive notification `inbound_order_completed`.
9. GRN document may be generated from receiving completion / contracts.

### State changes

```text
pending_approval / draft
        ↓ Approve
   in_progress (± partially_received)
        ↓ Complete receiving
   (still active until putaway)
        ↓ Complete putaway
     completed
```

### Side effects

- Warehouse tasks created/completed
- Inventory on-hand increases after putaway posting
- Notifications to client on confirm/complete
- Possible GRN PDF

### Failure / edge cases

- Over-receive beyond tolerance → error (*Received quantity exceeds the 110% over-receive tolerance.*)
- Cancelling mid-flow → **Cancelled**; tasks should not continue as active work
- Partial receive → **Partially received** until finished

---

## Negative tests for QA

| Attempt | Expected |
|---------|----------|
| Client tries to approve | No approve control; status stays waiting |
| Submit without lines | Blocked |
| Ship/arrival date in the past | Blocked |
| Duplicate rapid submits | Prefer single order or clear error — **NEEDS VERIFICATION** for double-click |
| Open completed order and re-approve | Action hidden or rejected |

---

## Cross-module links

Inbound → Tasks (receiving, putaway) → Inventory → Documents (GRN) → Notifications → Billing usage (may affect invoicing later)
