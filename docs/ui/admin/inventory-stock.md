# Inventory stock

**App:** Admin Dashboard
**Route(s):** `/inventory/stock` (`/inventory` redirects)
**Source:** `frontend/src/pages/InventoryPage.tsx`
**Nav label:** Inventory → Stock

## Purpose

Product-level on-hand stock summary across the active warehouse with search and barcode tools.

## Primary users

Route `inventory`: `super_admin`, `wh_manager`, `finance`. No extra role gates on page actions.

## User goals

- Find stock by product / SKU / barcode / lot / inbound order # / client
- Open product stock breakdown
- Preview product barcode image

## Business goal

Inventory truth for planning and storage billing.

## Main workflows

1. Apply Inventory filters → open row → `/inventory/product/:productId`
2. Scan barcode into search / show barcode image modal

## Components

- `FilterPanel` (`Inventory filters`)
- `FilterScanButton`
- `DataTable` title `Inventory`
- `BarcodeImageModal`, `BarcodeScanModal`

## Forms

- Filters only (read-only list).

## Tables

Rendered column headers: **Product**, **Client**, **SKU**, **Barcode**, **On hand**, **Reserved**, **Available**, **Total quantity**, **UOM**.

Note: the **Total quantity** header remaps `SUMMARY_COLUMNS` stock-health cell — badge values **Healthy**, **Low Stock**, **Critical**, **Out of Stock**. Barcode column is an icon button (`Show barcode`) when a barcode exists.

## Filters

FilterPanel: **Inventory filters**

| Field | Notes |
| --- | --- |
| Search | placeholder `Contains…` |
| Search by | Product name; SKU; Barcode; Lot number; Inbound order number |
| (scan) | FilterScanButton → BarcodeScanModal |
| Client | All clients + company list |

Apply / Reset filters.

## Actions

- Open product row
- Show barcode / scan into filter
- Clear filters

## Dialogs

- **BarcodeImageModal**
- **BarcodeScanModal**

## Drawers

- None.

## Empty states

- `No on-hand stock matches the current filters.`
- `Warehouse not resolved yet.`

## Loading states

- DataTable loading while warehouse/query pending.

## Validation

- N/A (no primary form).

## Permissions

- Route: inventory (sa/mgr/finance).

## Relationships with other pages

- → `/inventory/product/:productId`
- Sub-nav peers: Ledger, Adjustments

---

*Documentation only — derived from staging codebase. No UI redesign implied.*
