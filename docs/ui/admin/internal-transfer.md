# Internal transfer

**App:** Admin Dashboard
**Route(s):** `/internal`
**Source:** `frontend/src/pages/InternalTransferPage.tsx`
**Nav label:** Tasks → Internal transfer

## Purpose

Create and review internal stock location transfers with product/location barcode scan shortcuts.

## Primary users

**`super_admin` and `wh_manager` only** — route group `internal` uses `INTERNAL_TRANSFER_ROLES`; Tasks sub-nav entry likewise gated.

## User goals

- Move stock between eligible locations
- Filter source/destination by location type
- Review transfer history

## Business goal

Correct location accuracy without full outbound/inbound cycles.

## Main workflows

1. Create Internal Transfer → modal → submit Create transfer → history refresh
2. Scan product / source / destination barcodes inside modal

## Components

- `PageHeader` title `Internal transfer`
- History `DataTable`
- `CreateInternalTransferModal` (`Modal`)
- `BarcodeScanModal` (product + locations)

## Forms

**Create internal transfer** modal fields:

- Client (optional)
- Search / Search by (Product name, SKU, Barcode) + scan
- Product
- Lot (when lot-tracked)
- Source location type / Destination location type
- Source location / Scan source location
- Destination location / Scan destination location
- Quantity to transfer
- Footer: Create transfer

Location type options: All types; Storage; Fridge; Quarantine; Scrap.

## Tables

History columns: **When**, **Client**, **Product**, **Lot**, **Qty**, **From → To**, **Ref**.

## Filters

- No list FilterPanel; modal has product search + location type filters.

## Actions

- `Create Internal Transfer`
- Submit Create transfer
- Scan barcode helpers

## Dialogs

- **CreateInternalTransferModal** — title `Create internal transfer`
- **BarcodeScanModal** (multiple scan targets)

## Drawers

- None.

## Empty states

- History: `No internal transfers yet.`
- Modal product empty: `No products match the filters.`
- Lots: `No lots with on-hand stock in eligible locations.` / `Loading stock...`
- Destination empty hint: `No matching destination bins. Try another search or type filter.`

## Loading states

- History table loading; stock-by-product pending disables location pickers.

## Validation

- Required product, source/destination locations, quantity; lot when lot-tracked.

## Permissions

- Route + nav: `canAccessInternalTransfer` / `INTERNAL_TRANSFER_ROLES` → `super_admin` \| `wh_manager`.
- Operators and finance cannot access `/internal`.

## Relationships with other pages

- Listed under Tasks sub-nav alongside typed task queues
- Inventory effects visible later in Stock / Ledger

---

*Documentation only — derived from staging codebase. No UI redesign implied.*
