# 16 — Returns

**Confidence:** High for OMS return statuses and delivered precondition. Medium for every warehouse return disposition label in UI.

---

## Two return tracks

| Track | Portal entry | Linked order precondition |
|-------|--------------|---------------------------|
| **Online / OMS returns** | Client Store → Returns; Admin OMS → OMS Returns | OMS order **Delivered** |
| **Warehouse / Outbound returns** | Admin Returns; Client `/outbound-orders/returns` (no sidebar) | Outbound **Shipped** (client create) |

---

## OMS returns

### Statuses

Requested · Approved · Rejected · Completed · Cancelled  
(also `in_progress` may appear)

### Client create

1. Open **Returns** → **New online return** / Create return.
2. Select linked **Delivered** online order.
3. Enter reason/notes.
4. Add product lines with qty ≤ returnable remaining.
5. **Create return**.
6. Status **Requested**.

### Admin processing

1. Open OMS return detail.
2. Complete / edit return plan if required (`/oms/returns/:id/edit`).
3. **Approve** → creates/confirms warehouse return work; status **Approved**.
4. Warehouse receiving / putaway for return.
5. Complete → **Completed**; linked OMS order may become **Returned**.
6. Or **Reject** while requested → **Rejected**.

### Failure cases

- Link non-delivered order → cannot select / validation
- Qty above returnable → blocked
- Approve without plan when required → blocked

---

## Warehouse returns (admin `/returns`)

### Order statuses

draft · confirmed · receiving · inspecting · completed · cancelled

### Line statuses

pending · received · inspected · posted

### Conditions

new · good · damaged · unusable

### Dispositions

restock · quarantine · scrap · damaged · discard · inspection_required

### Typical admin steps

1. **+ New return** (or created from OMS approve).
2. Confirm from draft.
3. **Start receiving** / **Process**.
4. Inspect lines; set condition & disposition.
5. Complete → inventory effects based on disposition (restock increases available, scrap does not, etc.).

### Client outbound returns

Similar create form against shipped outbound; detail is view-oriented. Discoverability is weak (no sidebar) — use Quick jump.

---

## Cross-module

OMS Delivered → OMS Return Requested → Admin Approve → WH Return receiving → Inventory restock/quarantine → OMS Returned → Notifications / COD returned state possible
