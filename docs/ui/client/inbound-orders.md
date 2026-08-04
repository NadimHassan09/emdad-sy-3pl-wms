# Inbound orders

**App:** Client Portal  
**Route(s):** `/inbound-orders`  
**Source:** `client-frontend/src/pages/InboundOrdersPage.tsx`  
**Related:** `components/CreateClientInboundModal.tsx`  
**Nav label:** Inbound / الوارد (Warehouse)

## Purpose

List and create warehouse inbound (ASN) orders for the merchant company.

## Primary users

Admin + staff.

## User goals

- Track inbound status
- Create expected receipts (submit for approval)
- Open inbound detail

## Business goal

Feed WMS receiving with merchant-declared expected inventory.

## Main workflows

1. Search / status filter → row click → `/inbound-orders/:id`
2. **New inbound** → two-step modal → navigate to new detail
3. Retry on load failure

## Components

- `ListPageHeader`
- Search + status select
- Data table
- `TableFooterPagination`
- `Alert` / skeleton rows
- `CreateClientInboundModal` (+ `ClientOrderLinesTable`)

## Forms

### CreateClientInboundModal — **New inbound order** / طلب وارد جديد

**Step 1 — General information** / المعلومات العامة  

| Field | EN | AR | Notes |
|-------|----|----|-------|
| Expected arrival date | Expected arrival date | تاريخ الوصول المتوقع | required; `min=today` |
| Notes | Notes | ملاحظات | optional |

**Step 2 — Products** / المنتجات  

Line table: Product (Pick product… / اختر المنتج…), Quantity / الكمية, Remove / إزالة, **+ Add line** / + إضافة بند.  
Empty lines: **No lines yet — add a product below.** / لا توجد بنود بعد — أضف منتجاً بالأسفل.  
Helper: **Current quantity:** / الكمية الحالية:  
Product option hint (EN): `{uom} · on hand {qty}`.

Buttons: Cancel / إلغاء; Next / التالي; Back / رجوع; **Submit for approval** / إرسال للموافقة.

## Tables

List columns:

| EN | AR |
|----|----|
| Order # | رقم الطلب |
| Status | الحالة |
| Expected Arrival | الوصول المتوقع |
| Lines | البنود |
| Created | تاريخ الإنشاء |

No Actions column; entire row navigates.

## Filters

| Control | EN | AR |
|---------|----|----|
| Search | Search order number... | ابحث برقم الطلب... |
| Status | All statuses | كل الحالات |

Status option labels (EN except All): Draft, Waiting for approval, Confirmed, In progress, Partially received, Completed, Cancelled.

## Actions

| Control | EN | AR | Gate |
|---------|----|----|------|
| New inbound | New inbound | وارد جديد | `operationalAllowed` |
| Retry | Retry | إعادة المحاولة | |
| Pagination | Previous / Next | السابق / التالي | |

Disabled create `title` = `actionBlockedReason`.

## Dialogs

- `CreateClientInboundModal`.

## Drawers

- None (portal/admin use modals and full-page navigation rather than drawers on this screen).

## Empty states

- **No inbound orders found.** / لا توجد طلبات وارد.

## Loading states

- Pulse skeleton rows (no text). Pagination footer when loaded.

## Validation

Modal:  
- **Expected arrival date cannot be before today.** / لا يمكن أن يكون تاريخ الوصول قبل اليوم.  
- **Add at least one line with quantity.** / أضف بنداً واحداً على الأقل بكمية.  
Submit/API errors in rose alert; mutation fallback **Could not submit order.** (EN).  
List: **Could not load inbound orders** / تعذر تحميل طلبات الوارد.

## Permissions

Both roles. Create requires `useClientOperationalAccess().operationalAllowed` (`restricted` / `no_plan` block). Staff may create when billing allows (unlike products).

## Relationships with other pages

- → `/inbound-orders/:id`
- Products for line selection
- WMS Admin receives/confirm pipeline

---

*Documentation only — derived from staging codebase. No UI redesign implied.*
