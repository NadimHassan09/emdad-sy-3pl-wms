# Inbound orders list

**App:** Admin Dashboard
**Route(s):** `/orders/inbound` (aliases `/inbound`, `/orders`)
**Source:** `frontend/src/pages/InboundListPage.tsx`
**Nav label:** Inbound → Inbound orders

## Purpose

Warehouse inbound ASN list with create, cancel, delete, and barcode helpers for line entry.

## Primary users

Route group `orders`: `super_admin`, `wh_manager`, `finance`. Mutations that use `isAdmin = canAccessInternalTransfer(role)` require `super_admin` or `wh_manager`.

## User goals

- Find inbound orders by order #, client, status, or created date range
- Create a new ASN
- Open detail to confirm/receive

## Business goal

Start the inbound pipeline that feeds receiving tasks and stock.

## Main workflows

1. Apply filters → open row → `/orders/inbound/:id`
2. `+ New inbound` → CreateInboundModal → navigate to new detail
3. Row actions: Edit / Cancel order / Delete (admin + cancelled only)

## Components

- `PageHeader`
- `FilterPanel` (title `Order filters`)
- `DataTable` (server pagination)
- `EmptyState`
- `Button`
- `CreateInboundModal` (`Modal`)
- `ConfirmModal`
- `BarcodeScanModal` (inside create modal)

## Forms

CreateInboundModal (`New inbound order`):

- Client (`Pick a client…`)
- Expected arrival date
- Notes
- Lines: Product (`Pick product…`), Quantity; `+ Add line`; Scan barcode / Add by barcode
- Footer: Cancel, Next, Back, Create
- Empty lines copy: `No lines yet — add a product below.`

## Tables

DataTable columns: **Order #**, **Client**, **Status**, **Expected arrival**, **Lines**, **Created**, **Actions**.

Status cell may show inline hint **Missing quantities** when shortfall applies.

Row action menu (`Open actions`): Edit; Cancel order (when not completed/cancelled); Delete (admin and status `cancelled` only).

## Filters

FilterPanel title: **Order filters**

| Field | Notes |
| --- | --- |
| Order # | placeholder `Search order...` |
| Client | `All clients` + company list |
| Status | see options below |
| Created from | date |
| Created to | date |

Status options: All statuses; Draft; Pending approval; Confirmed; In progress; Partially received; Completed; Cancelled.

Buttons: Apply filters, Reset filters. Active chips: Order #, Client, Status, Created from, Created to.

## Actions

- `+ New inbound`
- Open row / Edit → detail
- Cancel order / Delete via ConfirmModal
- Clear filters / Retry on load error

## Dialogs

- **CreateInboundModal** — title `New inbound order`; nested **BarcodeScanModal**
- **ConfirmModal** — `Cancel this order?` (confirm `Cancel order`, cancel `Keep order`)
- **ConfirmModal** — `Delete this order?` (confirm `Delete`, cancel `Cancel`)

## Drawers

- None (modals and full-page navigation).

## Empty states

- Unresolved warehouse: `Warehouse not resolved yet.`
- Filtered empty: `No inbound orders match the filters.`
- First-run EmptyState: title `No inbound orders yet`; description `Create your first inbound order to start receiving stock.`
- Alerts: `Warehouse not configured` / `Could not load inbound orders` (+ Retry)

## Loading states

- DataTable skeleton while `pagination.isInitialLoading` or warehouse id unresolved.

## Validation

- Create form requires client and lines; confirm gates on cancel/delete.

## Permissions

- Route: `ROUTE_GROUP_ROLES.orders` → sa/mgr/finance.
- `isAdmin = canAccessInternalTransfer` (`super_admin` \| `wh_manager`): Delete only when cancelled.
- Edit when status `draft` \| `pending_approval`; Cancel when not `completed` \| `cancelled`.

## Relationships with other pages

- → `/orders/inbound/:id`
- Sub-nav peers: Outbound orders, Quick outbound

---

*Documentation only — derived from staging codebase. No UI redesign implied.*
