# Inventory (Products list)

**App:** Client Portal  
**Route(s):** `/products`  
**Source:** `client-frontend/src/pages/ProductsPage.tsx`  
**Related:** `components/CreateClientProductModal.tsx`, `ProductDetailsModal.tsx`, `ClientBarcodeImageModal.tsx`  
**Nav label:** Inventory / المخزون (Warehouse)

## Purpose

Browse sellable catalog with Available / Reserved / On-hand quantities and stock-health status; create products (admin + billing-allowed).

## Primary users

Admin + staff; **create restricted to `client_admin`**.

## User goals

- Find SKUs by name / SKU / barcode
- See sellable vs reserved stock
- Create new catalog products (admin)
- View details modal / barcode PNG

## Business goal

Keep merchant catalog and sellable stock visibility accurate for order creation and replenishment decisions.

## Main workflows

1. Debounced search → paginated results
2. **New product** → `CreateClientProductModal` → success alert **Product created.** (+ SKU)
3. Row / **View details** → `ProductDetailsModal`
4. Actions menu → **View barcode** → `ClientBarcodeImageModal` (download PNG)

## Components

- `ListPageHeader`
- Search input
- Data table + `Badge` stock health
- `AnchoredDropdown` row actions
- `TableFooterPagination`
- `EmptyState`, `Skeleton`, `Alert`
- Create / details / barcode modals

## Forms

### CreateClientProductModal — title **New product** / منتج جديد

| Field | Label EN | Label AR | Notes |
|-------|----------|----------|-------|
| Photo | Product photo | صورة المنتج | Optional; hint Optional. Images are compressed before saving. |
| Name | Name | الاسم | **required** |
| SKU | SKU (optional) | رمز SKU (اختياري) | Generate button; hint Leave blank to auto-generate. |
| Barcode | Barcode (optional) | الباركود (اختياري) | Generate button; same blank hint |
| Description | Description (optional) | الوصف (اختياري) | |
| UoM | UoM | وحدة القياس | Piece, Kilogram, Litre, Carton, Pallet, Box, Roll (+ AR) |
| Expiry | Product has an expiry date | المنتج له تاريخ انتهاء | Checkbox |

Buttons: **Cancel** / إلغاء, **Create** / إنشاء. Generate: **Generate** / إنشاء.  
Image validation: valid image file; max 8 MB (bilingual messages from `ImageUploadField`).

### ProductDetailsModal — read-only

Sections: General / معلومات عامة, Inventory / المخزون, Dimensions / الأبعاد, Audit / التدقيق.  
Fields include Name, SKU, Barcode, UoM, Category, Description, Stock on hand, Committed stock, Available for sale, Inventory method, Total inbound/outbound, L/W/H, Weight, Volume (m³), Created by/Created/Last updated.

### ClientBarcodeImageModal

Title `Barcode · {productName}` (EN “Barcode” not localized). **Close** / إغلاق, **Download PNG** / تحميل PNG. Errors: No barcode value.; Could not generate a barcode image…

## Tables

| Column EN | Column AR |
|-----------|-----------|
| Product | المنتج |
| SKU | رمز SKU |
| Available | المتاح |
| Reserved | المحجوز |
| On hand | المتواجد |
| Status | الحالة |
| Actions | الإجراءات |

Status badges: **In stock** / متوفر, **Low stock** / مخزون منخفض, **Out of stock** / نفد المخزون.

## Filters

- Debounced search placeholder: **Search name, SKU, or barcode...** / ابحث بالاسم أو رمز SKU أو الباركود...

## Actions

| Control | EN | AR | Gate |
|---------|----|----|------|
| New product | New product | منتج جديد | `isClientAdmin` + `operationalAllowed` |
| Create first product | Create first product | إنشاء أول منتج | same + empty (no search) |
| Open actions | Open actions | فتح الإجراءات | aria |
| View details | View details | عرض التفاصيل | |
| View barcode | View barcode | عرض الباركود | |
| Retry | Retry | إعادة المحاولة | |
| Pagination | Previous / Next | السابق / التالي | |

Disabled create `title` = `billingAccess.restriction.actionBlockedReason`.

## Dialogs

- `CreateClientProductModal`, `ProductDetailsModal`, `ClientBarcodeImageModal`.

## Drawers

- None (portal/admin use modals and full-page navigation rather than drawers on this screen).

## Empty states

| Condition | EN | AR |
|-----------|----|----|
| No catalog | No products found. | لا توجد منتجات. |
| Search miss | No products match your search. | لا توجد منتجات مطابقة لبحثك. |
| Hint | Add your first catalog product to track sellable stock. | أضف أول منتج في الكتالوج لتتبع المخزون القابل للبيع. |

## Loading states

- 6-row skeleton table (no text).
- Details modal: **Loading product…** / جاري تحميل المنتج….

## Validation

- Modal: Name required (HTML/required); SKU/barcode optional (server may auto-generate).
- Image type/size messages as above.
- API/submit errors in rose banner; parent may append **Image upload failed.** after create.
- List error: **Could not load products** / تعذر تحميل المنتجات.
- Success: **Product created.** / تم إنشاء المنتج.

## Permissions

- Route: both roles (`products` group).
- Create: **`isClientAdmin` AND `useClientOperationalAccess().operationalAllowed`**.
- Staff can list/view/barcode but not create.
- `restricted` / `no_plan` block create with `actionBlockedReason`; `expiring` does not block.
- Note: `roleAccessDeniedCopy` also has product-catalog wording for denied redirects; live RBAC still allows staff on `/products`.

## Relationships with other pages

- Modal detail keeps list; Dashboard / deep links may use `/products/:id` full page
- Created products feed inbound/outbound/OMS line pickers

---

*Documentation only — derived from staging codebase. No UI redesign implied.*
