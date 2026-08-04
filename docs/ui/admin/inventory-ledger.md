# Inventory ledger

**App:** Admin Dashboard
**Route(s):** `/inventory/ledger`
**Source:** `frontend/src/pages/InventoryLedgerPage.tsx`
**Nav label:** Inventory → Ledger

## Purpose

Chronological inventory movement ledger with search, movement-type filter, date range, and barcode resolve.

## Primary users

Route `inventory`: `super_admin`, `wh_manager`, `finance`.

## User goals

- Audit movements by product/client/type/date
- Jump to ledger entry / reference detail

## Business goal

Traceability for inventory changes.

## Main workflows

1. Filter / scan → open ledger entry path via `ledgerEntryDetailPath(...)`
2. Clear filters when empty

## Components

- `FilterPanel` (`Ledger filters`)
- `FilterScanButton`
- `DataTable` title `Inventory ledger`
- `BarcodeScanModal`

## Forms

- Filters only.

## Tables

Columns: **Product**, **Client**, **Movement type**, **When**, **Before quantity**, **Δ Qty**, **After quantity**.

## Filters

FilterPanel: **Ledger filters**

| Field | Notes |
| --- | --- |
| Search | text |
| Search by | Product name; SKU; Barcode |
| (scan) | FilterScanButton → BarcodeScanModal |
| Movement type | All movement types; Inbound; Outbound; Adjustments |
| Client | company list |
| Created from / Created to | dates |

Apply / Reset.

## Actions

- Open entry/reference row
- Scan barcode into search
- Reset filters

## Dialogs

- **BarcodeScanModal**

## Drawers

- None.

## Empty states

- `No ledger rows for the current filters.`
- `Warehouse not resolved yet.`

## Loading states

- DataTable loading / warehouse gate.

## Validation

- N/A (no primary form).

## Permissions

- Route: inventory (sa/mgr/finance).

## Relationships with other pages

- → ledger entry / reference detail routes from row click helpers
- Sub-nav: Stock, Adjustments

---

*Documentation only — derived from staging codebase. No UI redesign implied.*
