# Outbound orders list

**App:** Admin Dashboard
**Route(s):** `/orders/outbound` (alias `/outbound`)
**Source:** `frontend/src/pages/OutboundListPage.tsx`
**Nav label:** Outbound → Outbound orders

## Purpose

List and create warehouse outbound orders; cancel/delete with status gates.

## Primary users

Route `orders`: `super_admin`, `wh_manager`, `finance`. Admin mutations via `canAccessInternalTransfer` (sa/mgr).

## User goals

- Find outbound shipments
- Create outbound ASN
- Open detail for confirm / workflow

## Business goal

Drive pick → pack → dispatch pipeline.

## Main workflows

1. Filter → open `/orders/outbound/:id`
2. `+ New outbound` → CreateOutboundModal → detail
3. Cancel order / Delete (admin + cancelled)

## Components

- `PageHeader` / list header `Outbound orders`
- `FilterPanel` (`Order filters`)
- `DataTable`
- Empty / alert copy
- `CreateOutboundModal`, `ConfirmModal`, `BarcodeScanModal`

## Forms

CreateOutboundModal (`New outbound order`):

- Client, Required ship date, Carrier, Notes, Destination address
- Packing (checkbox)
- Lines (Product, Quantity) with Scan barcode / Add by barcode / `+ Add line`
- Footer: Cancel, Next, Back, Create

## Tables

Columns: **Order #**, **Client**, **Status**, **Required ship**, **Lines**, **Destination**, **Actions**.

Row actions: Edit; Cancel order; Delete (admin + cancelled).

## Filters

FilterPanel: **Order filters**

| Field | Notes |
| --- | --- |
| Order # | search |
| Client | All clients |
| Status | see options |
| Created from / Created to | dates |

Status options: All statuses; Draft; Pending approval; Pending stock; Confirmed; Picking; Packing; Ready to ship; Shipped; Cancelled.

Apply filters / Reset filters.

## Actions

- `+ New outbound`
- Open / Edit row
- Cancel order / Delete
- Retry on load failure

## Dialogs

- **CreateOutboundModal** — `New outbound order` (+ **BarcodeScanModal**)
- **ConfirmModal** — `Cancel this order?`
- **ConfirmModal** — `Delete this order?`

## Drawers

- None.

## Empty states

- `No outbound orders match the filters.` / `Warehouse not resolved yet.`
- Alerts: `Warehouse not configured`; `Failed to load outbound orders` (+ Retry)

## Loading states

- DataTable initial loading / warehouse unresolved gate.

## Validation

- Create modal client + lines; confirm gates on cancel/delete.

## Permissions

- Route: orders (sa/mgr/finance).
- `isAdmin = canAccessInternalTransfer`: Delete only when status `cancelled`.
- Edit when draft/pending_approval; Cancel when allowed by status checks in page.

## Relationships with other pages

- → `/orders/outbound/:id`
- Sub-nav: Quick outbound `/orders/directed-outbound`

---

*Documentation only — derived from staging codebase. No UI redesign implied.*
