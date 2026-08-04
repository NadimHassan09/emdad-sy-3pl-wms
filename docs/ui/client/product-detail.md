# Product detail

**App:** Client Portal  
**Route(s):** `/products/:id`  
**Source:** `client-frontend/src/pages/ProductDetailPage.tsx`  
**Nav label:** Inventory (detail)

## Purpose

Full-page stock and catalog fields for one SKU (on hand / reserved / available + identity and dimensions).

## Primary users

Admin + staff.

## User goals

- Inspect one product’s stock and catalog metadata
- Return to inventory list

## Business goal

Deep-link target from dashboard/notifications without requiring the list modal.

## Main workflows

1. Open `/products/:id` → review summary cards and fields → **Back to products**

## Components

- Back link
- Title / subtitle
- Summary metric cards
- Detail field grid
- `StatusBadge` (shared statusMeta where used)
- Skeleton on load

## Forms

- None (read-only).

## Tables

- None. Summary cards: **On hand** / المتوفر, **Reserved** / محجوز, **Available** / متاح.  
- Fields: SKU, Barcode, Description, UoM, Expiry tracking (**Yes**/**No** / نعم/لا), Min stock threshold, Dimensions (cm), Weight (kg), Created, Updated (+ AR map entries in page).

## Filters

- None.

## Actions

| Control | EN | AR |
|---------|----|----|
| Back | Back to products | العودة إلى المنتجات |

## Dialogs

- None on this page (barcode/create live on list).

## Drawers

- None (portal/admin use modals and full-page navigation rather than drawers on this screen).

## Empty states

- Missing values: `—`.
- Not found: **Product not found.** (+ AR in map).
- Load error: **Could not load product.** (+ AR).

## Loading states

- Skeleton blocks (no loading title string required).

## Validation

- N/A.

## Permissions

Both roles via products route group. No create controls; no `useClientOperationalAccess` gate on this read-only page.

## Relationships with other pages

- ← `/products`, Dashboard inventory links, notifications
- Sibling to list modals (`ProductDetailsModal`) which cover similar fields in overlay form

---

*Documentation only — derived from staging codebase. No UI redesign implied.*
