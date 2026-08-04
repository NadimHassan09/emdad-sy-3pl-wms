# Outbound orders

**App:** Client Portal  
**Route(s):** `/outbound-orders`  
**Source:** `client-frontend/src/pages/OutboundOrdersPage.tsx`  
**Related:** `components/CreateClientOutboundModal.tsx`  
**Nav label:** Outbound / الصادر (Warehouse)

## Purpose

List and create warehouse outbound shipments (non-OMS WMS outbounds).

## Primary users

Admin + staff.

## User goals

- Track outbound status
- Create warehouse shipments with stock-aware lines
- Open detail

## Business goal

Support non-ecommerce warehouse exits and visibility into WMS outbound lifecycle.

## Main workflows

1. Search / status filter → row → `/outbound-orders/:id`
2. **New outbound** → shipping + products wizard → detail
3. Retry on error

## Components

- `ListPageHeader`
- Search + status select
- Table + pagination
- `CreateClientOutboundModal` / `ClientOrderLinesTable`
- Alert / skeletons

## Forms

### CreateClientOutboundModal — **New outbound order** / طلب صادر جديد

**Step 1 — Shipping information** / معلومات الشحن  

| Field | EN | AR | Required |
|-------|----|----|----------|
| Destination | Destination | الوجهة | yes |
| Required ship date | Required ship date | تاريخ الشحن المطلوب | yes (`min=today`) |
| Carrier | Carrier | الناقل | no |
| Notes | Notes | ملاحظات | no |

**Step 2 — Products** / المنتجات — same line picker pattern as inbound, plus stock helpers:  
**Available** / المتاح, **Requested across lines** / المطلوب عبر البنود, **Exceeds available stock** / يتجاوز المخزون المتاح.  
Shortage summary: **Order cannot be created — insufficient stock:** … **requested** / مطلوب, **available** / متاح.

Buttons: Cancel, Next, Back, **Submit for approval** / إرسال للموافقة (disabled when shortages).

## Tables

| EN | AR |
|----|----|
| Order # | رقم الطلب |
| Status | الحالة |
| Recipient | المستلم |
| Required Ship | الشحن المطلوب |
| Lines | البنود |
| Created | تاريخ الإنشاء |

## Filters

| Control | EN | AR |
|---------|----|----|
| Search | Search order number... | ابحث برقم الطلب... |
| Status | All statuses | كل الحالات |

Status options (EN): Draft, Waiting for approval, Confirmed, Picking, Packing, Ready to ship, Shipped, Cancelled.

## Actions

| Control | EN | AR | Gate |
|---------|----|----|------|
| New outbound | New outbound | صادر جديد | `operationalAllowed` |
| Retry | Retry | إعادة المحاولة | |
| Pagination | Previous / Next | السابق / التالي | |

## Dialogs

- `CreateClientOutboundModal`.

## Drawers

- None (portal/admin use modals and full-page navigation rather than drawers on this screen).

## Empty states

- **No outbound orders found.** / لا توجد طلبات صادر. (per page map)

## Loading states

- Pulse skeleton rows; query pending.

## Validation

- **Destination is required.** / الوجهة مطلوبة.  
- **Required ship date cannot be before today.** / لا يمكن أن يكون تاريخ الشحن قبل اليوم.  
- **Add at least one line with quantity.** / أضف بنداً واحداً على الأقل بكمية.  
- **Insufficient stock for one or more products.** / مخزون غير كافٍ لمنتج واحد أو أكثر.  
- List: **Could not load outbound orders** / تعذر تحميل طلبات الصادر.

## Permissions

Both roles. Create gated by `useClientOperationalAccess().operationalAllowed`.

## Relationships with other pages

- → `/outbound-orders/:id` (may overlay OMS customer/financial + tracking when linked)

---

*Documentation only — derived from staging codebase. No UI redesign implied.*
