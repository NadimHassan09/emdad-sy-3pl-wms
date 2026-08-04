# Cash on delivery (My profits)

**App:** Client Portal  
**Route(s):** `/my-profits` (canonical); `/cod-reports` redirects here  
**Source:** `client-frontend/src/pages/CodReportsPage.tsx`  
**Nav label:** Cash on delivery / الدفع عند الاستلام (Store)

## Purpose

COD lifecycle reporting: summary cards and filtered list of COD-bearing online orders.

## Primary users

Admin + staff.

## User goals

- See COD order counts and total amount for current filters
- Filter by COD status and date range
- Open related online order

## Business goal

Clarify merchant cash position and payout readiness without burying it under “billing”.

## Main workflows

1. View summary cards → adjust COD status / date filters → open order row
2. Store pills to Online orders / Returns

## Components

- `ListPageHeader`
- `StorePillTabs`
- Summary cards
- COD status select + date inputs
- Data table
- Empty state
- Loading ellipsis

## Forms

Filter controls only (not a submit form):

| Control | EN | AR | Notes |
|---------|----|----|-------|
| COD status | All COD statuses | كل حالات التحصيل | options EN: Pending, Collected, Remitted, Settled |
| From date | title From date | من تاريخ | native date |
| To date | title To date | إلى تاريخ | native date |

## Tables

| EN | AR |
|----|----|
| Order # | رقم الطلب |
| Recipient | المستلم |
| COD amount | المبلغ |
| COD status | الحالة |
| Created | تاريخ الإنشاء |

## Filters

- COD status select
- From / To date (`title` attributes as above)
- Store pill context (sibling routes)

## Actions

| Control | Notes |
|---------|-------|
| Row navigate | → `/ecommerce-orders/:id` |
| Store pills | Online orders / Cash on delivery / Returns (+ AR) |

Header: **Cash on delivery** / الدفع عند الاستلام; subtitle **Collected and pending remittance** / المحصّل وبانتظار التحويل.

Summary cards: **COD orders** / طلبات الدفع عند الاستلام; **Matching filters** / مطابق للفلاتر; **Total COD amount** / إجمالي مبالغ التحصيل.

## Dialogs

- None.

## Drawers

- None (portal/admin use modals and full-page navigation rather than drawers on this screen).

## Empty states

| EN | AR |
|----|----|
| No cash-on-delivery orders | لا توجد طلبات دفع عند الاستلام |
| COD orders will appear here once they are processed. | ستظهر طلبات الدفع عند الاستلام هنا عند معالجتها. |

## Loading states

- Table/content shows `…` while loading.

## Validation

- N/A (filters only).

## Permissions

Both roles. **No `useClientOperationalAccess`** (read-only report; no create CTA).

## Relationships with other pages

- → `/ecommerce-orders/:id`
- ← Dashboard **View cash on delivery** / COD KPI
- Pills siblings `/ecommerce-orders`, `/returns`

---

*Documentation only — derived from staging codebase. No UI redesign implied.*
