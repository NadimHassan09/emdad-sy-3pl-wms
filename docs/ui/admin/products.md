# Products

**App:** Admin Dashboard
**Route(s):** `/products`
**Source:** `frontend/src/pages/ProductsPage.tsx`
**Nav label:** Products

## Purpose

Warehouse product catalog CRUD for tenant companies, with barcode tools and lifecycle actions.

## Primary users

Route `products`: `super_admin`, `wh_manager` only.

## User goals

- Create / edit products
- Suspend / unsuspend / archive / delete
- Barcode scan/image helpers
- Open product detail

## Business goal

Master data for inventory movements and OMS/WMS lines.

## Main workflows

1. Filter → create/edit modal
2. Row actions for lifecycle
3. Open `/products/:id`

## Components

- `FilterPanel` (`Product filters`)
- `DataTable` title `Products`
- Create/Edit product modals
- Barcode scan/image modals

## Forms

**New product** (`CreateProductModal`): Client, Name, SKU (optional), Barcode (optional), Description (optional), UOM, Min stock threshold, Length/Width/Height, Weight (kg, optional).

**Edit {sku}** (`EditProductModal`): corresponding editable fields.

## Tables

Columns: **Product Name**, **Client Name**, **SKU**, **Barcode**, **UOM**, **Stock**, **Stock health**, **Status**, **Actions**.

Action menu: Edit, Suspend, Unsuspend, Delete, Archive (browser `window.confirm` strings).

## Filters

FilterPanel: **Product filters**

| Field | Notes |
| --- | --- |
| Search | text |
| Search by | Product name; SKU; Barcode |
| (scan) | barcode scan control |
| Client | company filter |

## Actions

- `+ New product`
- Edit / Suspend / Unsuspend / Delete / Archive
- Open detail
- Barcode helpers

## Dialogs

- CreateProductModal — `New product`
- EditProductModal — `Edit {sku}`
- BarcodeImageModal / BarcodeScanModal (where used)
- Browser confirms for destructive lifecycle

## Drawers

- None.

## Empty states

- `No products match the filters.`

## Loading states

- DataTable loading.

## Validation

- Create/edit required fields (name, client, UOM, etc. per modal).

## Permissions

- Route/nav: `super_admin`, `wh_manager`.

## Relationships with other pages

- → `/products/:id`
- Used by inbound/outbound/OMS line pickers

---

*Documentation only — derived from staging codebase. No UI redesign implied.*
