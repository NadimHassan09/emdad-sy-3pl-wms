# 07 — Inventory

**Confidence:** High for admin stock views and client product-level stock. Medium for adjustment approval nuances and ledger deep-link UX.

---

## Purpose

Inventory shows what is on hand, reserved, and available; supports locations, adjustments, and (admin) ledger inspection. Clients see product-level availability only.

---

## Admin — Stock

### Entry

Sidebar **Inventory** → Stock (`/inventory/stock`). Tabs: **Stock · Adjustments**.

### Visible concepts

| Concept | User meaning |
|---------|--------------|
| On hand | Physical quantity |
| Reserved | Held for orders |
| Available | Can still be promised |
| Stock health | Healthy / Low Stock / Critical / Out of Stock |
| Location | Bin / area in warehouse |
| Lot / expiry | When product is lot-tracked |

Stock statuses used internally: available, quarantined, awaiting_putaway (awaiting putaway is on-hand but not pickable).

### Actions

- Search / filter stock
- Open product stock detail
- Navigate to ledger references when linked

### Empty / loading

- Loading while fetching
- Empty table when no stock rows match filters

---

## Admin — Adjustments

### Purpose

Correct stock with controlled documents.

### Statuses

`draft` → `approved` | `cancelled`

### Steps (typical)

1. Inventory → Adjustments → **+ New adjustment**.
2. Enter adjustment lines / reason (exact fields: verify on form).
3. Save as draft.
4. Approve when authorized (manager/super admin).
5. Stock figures update after approval.

### Failure cases

- Approve without permission → denied
- Cancel after approved → not allowed (or limited)

**Confidence:** Medium for exact form field list.

---

## Admin — Products, Locations, Warehouses

These master data screens feed inventory:

- **Products:** SKU, barcode, UoM, tracking mode, images
- **Locations:** type, active/suspended/archived
- **Warehouses:** active/inactive

Operators generally do **not** see Products / Locations / Warehouses in the sidebar.

---

## Client — Inventory

### Entry

Sidebar **Inventory** → `/products`.

### What clients see

- Product list with **Available**, **Reserved**, **On hand**
- Health: In stock / Low stock / Out of stock
- Product detail
- Dashboard live inventory widgets

### What clients do **not** see

- Location bins
- Lot breakdown
- Stock adjustment tools

### Mutations

| Action | client_admin | client_staff |
|--------|:------------:|:------------:|
| View | ✓ | ✓ |
| Create / Edit / Delete product | ✓ | — |

---

## How inventory interacts with orders

| Event | Inventory effect (user-visible outcome) |
|-------|------------------------------------------|
| Create OMS/outbound with stock check | Error if available insufficient; **no reserve** on client OMS create |
| Approve OMS | Stock re-checked; outbound Draft; reserve only if allocate-on-create enabled |
| Outbound approve (task-only) | Soft-reserve possible; **on-hand not deducted** |
| Pick start | Reserved increases / holds applied |
| Pick complete | Picked qty set; still reserved |
| Dispatch / shipped (task-only) | **On-hand and reserved decrease** |
| Inbound receive | On-hand↑ as awaiting putaway (**not pickable**) |
| Inbound putaway complete | Becomes available (or quarantined) |
| Return restock | On-hand may increase after posting |

**Invariant:** `Available = On hand − Reserved` (see `18` BR-INV-001, `19` CALC-INV-001).

Deep rules: `18-BUSINESS-RULES-AND-INVARIANTS.md`, `20-CROSS-MODULE-INVARIANTS.md`. If staging feature flags disable task-only flows, timing may differ — see `22-DOCUMENTATION-CONFLICTS.md` CONFLICT-002.

---

## Negative tests

| Attempt | Expected |
|---------|----------|
| Order qty > available | Insufficient stock message |
| Staff creates product | Redirect / no create |
| Adjust on archived location | Blocked or validation — **NEEDS VERIFICATION** |
| View quarantined stock as pickable | Should not be available for normal pick |
