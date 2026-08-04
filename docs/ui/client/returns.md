# Returns

**App:** Client Portal  
**Route(s):** `/returns`  
**Source:** `client-frontend/src/pages/ReturnsPage.tsx`  
**Nav label:** Returns / المرتجعات (Store)

## Purpose

Paginated list of return orders for goods coming back after delivery. No merchant create flow.

## Primary users

Admin + staff.

## User goals

- Browse returns
- Open return detail
- Switch to Online orders / COD via pills

## Business goal

Visibility into reverse logistics impacting inventory and COD.

## Main workflows

1. List → row → `/returns/:id`
2. Store pills navigation

## Components

- `ListPageHeader`
- `StorePillTabs`
- Data table
- Pagination (as implemented)
- Empty state
- Loading `…`

## Forms

- None (no merchant create modal).

## Tables

| EN | AR |
|----|----|
| Return # | رقم الإرجاع |
| Status | الحالة |
| Original order | الطلب الأصلي |
| Lines | البنود |
| Created | تاريخ الإنشاء |

## Filters

- No page-level search/status filters.
- Store pill tabs only: Online orders / Cash on delivery / Returns (+ AR).

## Actions

| Control | Notes |
|---------|-------|
| Row navigate | → `/returns/:id` |
| Store pills | sibling store routes |

Header: **Returns** / المرتجعات; subtitle **Online, COD, and returns** / الإلكترونية، الدفع عند الاستلام، والمرتجعات.

## Dialogs

- None.

## Drawers

- None (portal/admin use modals and full-page navigation rather than drawers on this screen).

## Empty states

| EN | AR |
|----|----|
| No returns yet | لا توجد مرتجعات بعد |
| Returns appear here when delivered orders come back to the warehouse. | تظهر المرتجعات هنا عندما تعود الطلبات المسلّمة إلى المستودع. |

## Loading states

- Content shows `…` while query pending.

## Validation

- N/A.

## Permissions

Both roles. No `useClientOperationalAccess` (read-only list).

## Relationships with other pages

- → `/returns/:id`
- Store pills siblings `/ecommerce-orders`, `/my-profits`

---

*Documentation only — derived from staging codebase. No UI redesign implied.*
