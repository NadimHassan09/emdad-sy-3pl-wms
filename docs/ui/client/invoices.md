# Invoices

**App:** Client Portal  
**Route(s):** `/invoices`  
**Source:** `client-frontend/src/pages/InvoicesPage.tsx`  
**Nav label:** Invoices / الفواتير (Account)

## Purpose

Invoice history with status filter; open or print invoices.

## Primary users

`client_admin` only.

## User goals

- Find invoices by payment status
- View invoice detail
- Open print view (`?print=1`)

## Business goal

Self-serve receivables visibility for merchants.

## Main workflows

1. Filter by status → paginate
2. **View** → `/invoices/:id`
3. **Print** → `/invoices/:id?print=1`

## Components

- Page header (Invoices / الفواتير; subtitle Invoice history and payment status / سجل الفواتير وحالة الدفع)
- Status `<select>`
- Data table
- `TableFooterPagination`
- Status badges via `humanizeInvoiceStatus` (English labels)

## Forms

Status filter only (not a submit form):

| Option EN | Option AR | Value |
|-----------|-----------|-------|
| All statuses | كل الحالات | `''` |
| Pending | قيد الانتظار | `unpaid` |
| Overdue | متأخر | `overdue` |
| Paid | مدفوعة | `paid` |
| Draft | مسودة | `draft` |
| Cancelled | ملغاة | `cancelled` |

## Tables

| Column EN | Column AR |
|-----------|-----------|
| Invoice # | رقم الفاتورة |
| Invoice date | تاريخ الفاتورة |
| Billing period | فترة الفوترة |
| Due date | تاريخ الاستحقاق |
| Amount | المبلغ |
| Currency | العملة (always `SYP`) |
| Payment status | حالة الدفع |
| Payment date | تاريخ الدفع (`—` unless paid) |
| Actions | إجراءات |

Payment status badge text from `humanizeInvoiceStatus()` is **English-only** even in AR UI: Pending, Overdue, Paid, Draft, Cancelled.

## Filters

- Payment status select (values above).

## Actions

| Control | EN | AR |
|---------|----|----|
| View | View | عرض |
| Print | Print | طباعة |
| Previous / Next | Previous / Next | السابق / التالي |

Footer: **Showing {start}-{end} of {total} results** / عرض {start}-{end} من {total} نتيجة.

## Dialogs

- None.

## Drawers

- None (portal/admin use modals and full-page navigation rather than drawers on this screen).

## Empty states

| Condition | EN | AR |
|-----------|----|----|
| No rows | No invoices yet. | لا توجد فواتير بعد. |
| Filtered | No invoices match this filter. | لا توجد فواتير تطابق هذا الفلتر. |

Loading cell text may show `…`.

## Loading states

- Query pending; table placeholder `…` while loading.

## Validation

- N/A.

## Permissions

- `client_admin` only (`rbac` billing group). Staff denied → dashboard + role-access banner.
- No `useClientOperationalAccess`.

## Relationships with other pages

- → `/invoices/:id` (+ `?print=1`)
- ← Billing **View all invoices**
- Legacy `/billing/invoices` may redirect into this area

---

*Documentation only — derived from staging codebase. No UI redesign implied.*
