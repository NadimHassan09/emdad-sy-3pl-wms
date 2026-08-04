# Invoice detail

**App:** Client Portal  
**Route(s):** `/invoices/:id` (+ legacy `/billing/invoices/:id` redirect)  
**Source:** `client-frontend/src/pages/BillingInvoiceDetailPage.tsx`  
**Nav label:** Invoices (detail)

## Purpose

Invoice summary, rate snapshot, charge breakdown, payment info, and timeline; optional auto-print via `?print=1`.

## Primary users

`client_admin` only.

## User goals

- Understand charges and rate snapshot
- Print invoice
- See payment timeline

## Business goal

Transparent billing statements reduce disputes.

## Main workflows

1. Open detail → review sections
2. Optional `?print=1` → `window.print()` after ~400ms → query param cleared
3. **Print** button / **Back to invoices**

## Components

- `ClientDetailShell`
- `DetailSection` / `DetailField` / `DetailGrid`
- Status badge (`humanizeInvoiceStatus`, English)
- Charge / line breakdown
- Timeline events

## Forms

- None.

## Tables

No classic list table. Charge lines rendered as labeled rows:

| Line EN | Line AR |
|---------|---------|
| Fixed subscription | الاشتراك الثابت |
| Inbound totals | إجمالي الوارد |
| Outbound totals | إجمالي الصادر |
| Packaging totals | إجمالي التغليف |
| Quality check totals | إجمالي فحص الجودة |
| Volume charges | رسوم الحجم |
| Weight charges | رسوم الوزن |
| Subtotal | المجموع الفرعي |
| Discount | الخصم |
| Taxes ({pct}%) | الضرائب ({pct}%) |
| Grand total | الإجمالي |

Additional manual/order lines use `line.description ?? line.type` from API.

## Filters

- None.

## Actions

| Control | EN | AR |
|---------|----|----|
| Back | Back to invoices | العودة إلى الفواتير |
| Print | Print | طباعة |

Shell states: Loading invoice… / جاري تحميل الفاتورة…; Invoice not found / الفاتورة غير موجودة; Could not load this invoice / تعذر تحميل هذه الفاتورة.

## Dialogs

- None.

## Drawers

- None (portal/admin use modals and full-page navigation rather than drawers on this screen).

## Empty states

- Rate snapshot: **No rate snapshot for this billing cycle.** / لا توجد لقطة أسعار لهذه الدورة.
- Missing fields: `—`.

## Loading states

- Shell title **Loading invoice…** / جاري تحميل الفاتورة….

## Validation

- N/A. Error descriptions: **This invoice is missing or you do not have access.** / الفاتورة غير موجودة أو ليس لديك صلاحية الوصول.; **Please try again.** / حاول مرة أخرى.

## Permissions

- `client_admin` only. Staff redirected away from billing group.
- No `useClientOperationalAccess`.

## Relationships with other pages

- ← `/invoices` View / Print
- Sections: Summary; Billing plan snapshot (fees: Fixed subscription, Inbound/Outbound/Packaging/QC, Excess volume/weight per day, Reserved volume, Snapshotted at); Payment information; Invoice timeline (Invoice created / issued / Payment due / Marked paid + AR)

---

*Documentation only — derived from staging codebase. No UI redesign implied.*
