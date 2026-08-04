# OMS orders list

**App:** Admin Dashboard
**Route(s):** `/orders/oms`
**Source:** `frontend/src/pages/OmsOrdersListPage.tsx`
**Nav label:** OMS Orders

## Purpose

Merchant OMS / ecommerce orders list with create, edit, and delete.

## Primary users

Nav/route for OMS: `super_admin`, `wh_manager`, `finance` (path under `/orders` uses orders group; nav item uses OMS roles). Client filter shown when `isAdmin = canAccessInternalTransfer`.

## User goals

- Find merchant orders
- Create / edit OMS order
- Open detail for approve lifecycle

## Business goal

Bridge merchants to WMS outbound.

## Main workflows

1. Filter → `/orders/oms/:id`
2. Create OMS Order / Edit → OmsOrderFormModal
3. Delete → ConfirmModal

## Components

- `PageHeader` — title `OMS Orders`; subtitle `Manage ecommerce and OMS fulfillment orders.`
- `FilterPanel` (`Order filters`)
- `DataTable`
- `OmsOrderFormModal`, `ConfirmModal`

## Forms

OmsOrderFormModal titles: `Create OMS Order` / `Edit OMS Order`.

Fields include: Client, Recipient name, Recipient phone, Required ship date, Carrier, Sales channel, Payment method, Shipping fee, Currency, Notes, Product / Qty / Price lines.

## Tables

Columns: **Order #**, **Customer**, **Status**, **Sales Channel**, **Total**, **Linked Outbound Order** (`Not Linked` or link), **Created At**, **Updated At**, **Actions**.

Row actions: Edit, Delete.

## Filters

FilterPanel: **Order filters**

| Field | Notes |
| --- | --- |
| Search | `Search order…` |
| Client | only if `isAdmin` (sa/mgr) |
| Status | All statuses + lifecycle statuses (Pending approval, Approved, Rejected, Draft, Confirmed, Allocated, Picking, Packing, Ready to ship, Out for delivery, Shipped, Delivered, Failed delivery, Completed, Returned, Cancelled) |
| Sales channel | free-text `TextField` |
| Warehouse link | All; Linked; Not linked |
| Created from / Created to | dates |

## Actions

- Create OMS Order
- Edit / Delete row
- Open detail / linked outbound

## Dialogs

- **OmsOrderFormModal** — Create / Edit
- **ConfirmModal** — `Delete this e-commerce order?`

## Drawers

- None.

## Empty states

- `No e-commerce orders match the filters.`

## Loading states

- DataTable loading.

## Validation

- Form modal field validation on create/edit.

## Permissions

- Nav OMS Orders: sa/mgr/finance.
- Client filter gated by `canAccessInternalTransfer` (sa/mgr).

## Relationships with other pages

- → `/orders/oms/:id`
- Linked outbound → `/orders/outbound/:id`
- Peers: OMS Dashboard, COD, OMS Returns

---

*Documentation only — derived from staging codebase. No UI redesign implied.*
