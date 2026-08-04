# Locations

**App:** Admin Dashboard
**Route(s):** `/locations`
**Source:** `frontend/src/pages/LocationsPage.tsx` (+ `LocationsDrillDownTable`)
**Nav label:** Locations

## Purpose

Hierarchical warehouse locations with breadcrumb drill-down, CRUD, barcode tools, and stock-at-location modal.

## Primary users

Route `locations`: `super_admin`, `wh_manager` only.

## User goals

- Navigate location tree
- Create / edit / suspend locations
- View current stock at a location
- Manage barcodes

## Business goal

Spatial model for putaway, pick, receiving docks, and quarantine/scrap.

## Main workflows

1. Breadcrumb drill → filter → CRUD
2. Current stock → LocationStockModal
3. Permanent delete subtree confirm

## Components

- `PageHeader` title `Locations`; CTA `+ New location`
- Breadcrumb (`Location hierarchy`)
- `FilterPanel` (`Location filters`)
- `LocationsDrillDownTable`
- `CreateLocationModal`, `EditLocationModal`
- `LocationStockModal`, `BarcodeImageModal`, `BarcodeScanModal`

## Forms

**New location**: Name, Type, Barcode (optional auto-generate hint), Max weight (kg, optional), Max volume (CBM, optional) when type supports capacity; parent via `LocationParentPicker`. Footer Create.

**Edit location**: Name, Type, Barcode (required), capacity fields when supported. Footer Save.

## Tables

Drill-down columns: expand control, **Location**, **Type**, **Location Code**, **Barcode**, **Status**, **Capacity**, actions.

LocationStockModal (`Stock · {fullPath}`) headers: **Product**, **SKU**, **Lot**, **Available**, **On hand**.

## Filters

FilterPanel: **Location filters**

| Field | Notes |
| --- | --- |
| Location name | text |
| Barcode | text |
| Scan barcode | camera scan updates barcode filter |
| Location type | All types; Aisle; Storage; Fridge; Packing; Receiving dock; Shipping dock; Quarantine; Scrap |

## Actions

Action menu (`Location actions`): Barcode image, Current stock, Edit location, Suspend, Unsuspend, Permanent delete…

## Dialogs

- **CreateLocationModal** — `New location`
- **EditLocationModal**
- **LocationStockModal** — `Stock · …` (Close)
- Delete modal — `Delete location subtree?` (cannot be undone)
- **BarcodeImageModal**, **BarcodeScanModal**

## Drawers

- None.

## Empty states

- `No locations at this level match the filters.`
- Stock modal: `No stock rows at this location.` / `Loading stock…`

## Loading states

- Table loading for current level; stock modal loading.

## Validation

- Create/edit name (+ barcode on edit); capacity fields optional.

## Permissions

- Route/nav: `super_admin`, `wh_manager`.

## Relationships with other pages

- Stock modal is in-page; putaway/pick pickers reuse location catalog elsewhere

---

*Documentation only — derived from staging codebase. No UI redesign implied.*
