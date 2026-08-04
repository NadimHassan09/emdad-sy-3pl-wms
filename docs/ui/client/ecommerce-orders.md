# Online orders (OMS)

**App:** Client Portal  
**Route(s):** `/ecommerce-orders`  
**Source:** `client-frontend/src/pages/EcommerceOrdersPage.tsx`  
**Related:** `components/CreateClientOmsOrderModal.tsx`, `StorePillTabs`  
**Nav label:** Online orders / الطلبات الإلكترونية (Store)

## Purpose

Primary merchant order surface for store-channel OMS orders: list, filter, create.

## Primary users

Admin + staff.

## User goals

- Find orders by number/status
- Create channel orders (submit for approval)
- Open order detail
- Jump COD / Returns via store pills

## Business goal

Make OMS the default merchant order entry and tracking path (demote raw WMS lists).

## Main workflows

1. `StorePillTabs` → Online orders / Cash on delivery / Returns
2. Search + status filter → row → `/ecommerce-orders/:id`
3. **Create order** / empty CTA → `CreateClientOmsOrderModal` → detail

## Components

- `ListPageHeader`
- `StorePillTabs`
- Search + status select
- `Card` table + badges
- `EmptyState`, `Skeleton`, `Button`
- `TableFooterPagination`
- `CreateClientOmsOrderModal`

## Forms

### CreateClientOmsOrderModal — **Create OMS Order** / إنشاء طلب OMS

Info banner: **Order will be submitted for admin approval. Shipping fee is set by the warehouse.** (+ AR).

**Shipping information**  

| Field EN | Field AR |
|----------|----------|
| Recipient name | اسم المستلم |
| Recipient phone | هاتف المستلم |
| City | المدينة |
| District | المنطقة |
| Address | العنوان |

**Order details**  

| Field EN | Field AR | Notes |
|----------|----------|-------|
| Required ship date | تاريخ الشحن المطلوب | required |
| Sales channel | قناة البيع | |
| Payment method | طريقة الدفع | options EN: —, COD, Prepaid, Credit |
| Notes | ملاحظات | |

**Products** grid: Product (Pick product…), Qty, Price (required per line), Remove, **+ Add line**. Stock helpers same as outbound (Available / Requested across lines / Exceeds…). Default new-line qty `1`.

Buttons: **Cancel** / إلغاء, **Submit for approval** / إرسال للموافقة (disabled on shortages).

## Tables

| EN | AR |
|----|----|
| Order # | رقم الطلب |
| Status | الحالة |
| Recipient | المستلم |
| Channel | القناة |
| Total | الإجمالي |
| Created | تاريخ الإنشاء |

## Filters

| Control | EN | AR |
|---------|----|----|
| Search | Search order number... | ابحث برقم الطلب... |
| Status | All statuses | كل الحالات |

Status options (EN labels): Pending approval, Approved, Rejected, Draft, Allocated, Picking, Packing, Ready to ship, Out for delivery, Shipped, Delivered, Failed delivery, Completed, Returned, Cancelled.

Store pills: Online orders / الطلبات الإلكترونية; Cash on delivery / الدفع عند الاستلام; Returns / المرتجعات.

## Actions

| Control | EN | AR | Gate |
|---------|----|----|------|
| Create order | Create order | إنشاء طلب | `operationalAllowed` |
| Create first order | Create first order | إنشاء أول طلب | same + empty |
| Retry | Retry | إعادة المحاولة | |
| Pagination | Previous / Next | السابق / التالي | |

## Dialogs

- `CreateClientOmsOrderModal`.

## Drawers

- None (portal/admin use modals and full-page navigation rather than drawers on this screen).

## Empty states

| Condition | EN | AR |
|-----------|----|----|
| None yet | No online orders yet | لا توجد طلبات إلكترونية بعد |
| Hint | Create an order from your store channel to track it here. | أنشئ طلباً من قناة متجرك لتتبعه هنا. |
| Filtered | No online orders match the filters. | لا توجد طلبات إلكترونية مطابقة للفلاتر. |

## Loading states

- Skeleton rows.

## Validation

- **Required ship date cannot be before today.** / لا يمكن أن يكون تاريخ الشحن قبل اليوم.  
- **Add at least one line with quantity and price.** / أضف بنداً واحداً على الأقل بكمية وسعر.  
- **Each product line needs a valid price.** / كل بند يحتاج سعراً صالحاً.  
- **Insufficient stock for one or more products.** / مخزون غير كافٍ لمنتج واحد أو أكثر.  
- List: **Could not load online orders** / تعذر تحميل الطلبات الإلكترونية (per page map).

## Permissions

Both roles. Create requires `useClientOperationalAccess().operationalAllowed`. Header subtitle: **Orders from your store channels** / طلبات من قنوات متجرك.

## Relationships with other pages

- → `/ecommerce-orders/:id`
- Pills → `/my-profits`, `/returns`
- ← Dashboard attention KPI / New order

---

*Documentation only — derived from staging codebase. No UI redesign implied.*
