# Billing

**App:** Client Portal  
**Route(s):** `/billing`  
**Source:** `client-frontend/src/pages/BillingPage.tsx`  
**Nav label:** Billing / الفوترة (Account)

## Purpose

Subscription status, usage vs plan limits, charts/stats, next-invoice preview, included features, and billing restriction notices.

## Primary users

`client_admin` only.

## User goals

- Understand plan & limits
- See usage (inventory, orders, warehouse volume)
- Preview next invoice
- Navigate invoices
- Contact sales / upgrade

## Business goal

Reduce churn/confusion around plan limits and drive invoice payment awareness.

## Main workflows

1. View Important notices (restriction/expiring copy)
2. Review Current subscription → Upgrade / Contact sales mailto
3. Scan Current resource usage cards
4. Read Subscription limits table
5. Next invoice preview → **View all invoices**
6. Scan Included features chips

## Components

- Page header
- Important notices `Alert` (from `buildBillingRestrictionCopy`)
- Subscription / usage / limits / preview / features sections
- Recharts or stat cards as implemented
- Plan status badges
- Mailto CTAs

## Forms

- None (read-only commercial surface).

## Tables

**Subscription limits**

| Column EN | Column AR |
|-----------|-----------|
| Limit | الحد |
| Current usage | الاستخدام الحالي |
| Maximum limit | الحد الأقصى |
| Progress | التقدم |
| % | % |

Row labels: Warehouse volume / حجم المستودع, Products / المنتجات, Users / المستخدمون, Monthly orders / الطلبات الشهرية.  
Unlimited: **Unlimited** / غير محدود. Users usage may show `—`.

## Filters

- None.

## Actions

| Control | EN | AR | Notes |
|---------|----|----|-------|
| Retry | Retry | إعادة المحاولة | load error |
| Upgrade plan | Upgrade plan | ترقية الخطة | mailto/sales path as coded |
| Contact sales | Contact sales | تواصل مع المبيعات | `mailto:sales@emdadsy.com?subject=Sales inquiry` (empty-plan CTA) |
| View all invoices | View all invoices | عرض كل الفواتير | → `/invoices` |

**Section labels:** Current subscription / الاشتراك الحالي; Current resource usage / استخدام الموارد الحالي; Next invoice preview / معاينة الفاتورة التالية; Included features / الميزات المشمولة; Important notices / تنبيهات مهمة.

Subscription fields: Price, Billing cycle, Next billing, Auto-renewal (On/Off / مفعّل/متوقف).  
Plan names: Monthly / Quarterly / Yearly / Warehouse Plan (+ AR). Status: Active / Expiring / Suspended (+ AR).  
Usage cards: Inventory (Total items, Total SKUs), Orders this billing cycle (Total, Inbound, Outbound), Warehouse capacity (Used, Remaining, m³).  
Preview: Estimated amount, Estimated billing date, Payment method **Manual settlement** / تسوية يدوية; currency `SYP`.  
Feature chips: OMS, WMS, Inventory Management, Returns Management, Client Portal, Barcode Support, Reporting, Notifications (+ AR).

## Dialogs

- None.

## Drawers

- None (portal/admin use modals and full-page navigation rather than drawers on this screen).

## Empty states

No active plan:  
- **No active billing plan on file.** / لا توجد خطة فوترة نشطة.  
- **Contact your account manager to set up a subscription.** / تواصل مع مدير حسابك لإعداد الاشتراك.  
- CTA **Contact sales** / تواصل مع المبيعات.

## Loading states

- Query pending / skeleton as implemented; error **Could not load billing** / تعذر تحميل الفوترة.

## Validation

- N/A.

## Permissions

- Route group `billing`: **`client_admin` only**. `client_staff` hitting `/billing` → redirect `/dashboard` with `ClientRoleAccessBanner` (**Page not available for your role** — Billing and invoices are available to client administrators only…).
- Page itself does not call `useClientOperationalAccess`; restriction copy is shown via `buildBillingRestrictionCopy` for notices. Layout banner may hide on `/billing*` when still `operationalAllowed`.

## Relationships with other pages

- → `/invoices`
- ← Profile Billing card (admin)
- ← `BillingRestrictionBanner` **View billing** link (admin)

---

*Documentation only — derived from staging codebase. No UI redesign implied.*
