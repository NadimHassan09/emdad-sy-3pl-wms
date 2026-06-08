# BILLING-2B — Admin Invoice Management Report

**Generated:** 2026-06-08  
**Environment:** Staging codebase (`emdad-sy-3pl-wms`)  
**Depends on:** BILLING-1A (domain), BILLING-1B (invoice engine), BILLING-2A (plans UI)  
**Deliverable:** This file only

---

## Executive Summary

BILLING-2B adds admin **Invoice Management** to the internal WMS frontend plus a dashboard widget for billing cycles expiring soon. Finance and warehouse admins can list invoices with filters, open invoice detail with plan snapshot and line breakdown, and renew cycles directly from the dashboard.

| Capability | Status |
|------------|--------|
| List page `/billing/invoices` | **Done** |
| Detail page `/billing/invoices/:id` | **Done** |
| Filters (client, status, date range) | **Done** |
| Table columns per spec | **Done** |
| Plan snapshot + line totals on detail | **Done** |
| Renewal status on detail | **Done** |
| Dashboard expiring-clients widget | **Done** |
| Billing section sub-nav (Plans \| Invoices) | **Done** |

---

## 1. Routes

| Path | Component | Access |
|------|-----------|--------|
| `/billing/invoices` | `BillingInvoicesPage` | `super_admin`, `wh_manager`, `finance` |
| `/billing/invoices/:id` | `BillingInvoiceDetailPage` | same |

Registered in `frontend/src/router.tsx`. Section sub-nav under `/billing` shows **Plans** and **Invoices** tabs via `frontend/src/lib/section-sub-nav.ts`.

**Renew** on the dashboard widget is shown only for `super_admin` and `wh_manager`, matching backend `InternalAdminGuard`.

---

## 2. Page 1 — Invoice Table

**File:** `frontend/src/pages/billing/BillingInvoicesPage.tsx`

### Filters

| Filter | Implementation |
|--------|----------------|
| Client | Combobox → `companyId` (client-side filter) |
| Status | Draft / Open / Paid / Cancelled |
| Date range | `dateFrom` / `dateTo` on `createdAt` |

Data sources (parallel TanStack Query):

- `GET /api/billing/invoices`
- `GET /api/companies?includeAll=true`

Rows filtered client-side via `filterInvoiceRows()` in `frontend/src/lib/billing-invoice-display.ts`.

### Columns

| Column | Source |
|--------|--------|
| Invoice number | `invoiceNumber` |
| Client | Company name (joined by `companyId`) |
| Cycle | `formatCycleLabel(billingCycle)` |
| Amount | `totalAmount` |
| Status | `StatusBadge` |
| Created | `createdAt` |

**Row click** → `/billing/invoices/:id`

---

## 3. Page 2 — Invoice Details

**File:** `frontend/src/pages/billing/BillingInvoiceDetailPage.tsx`

Sections:

1. **Summary** — client, billing cycle, status, created/issued dates  
2. **Billing plan snapshot** — rates and reservations from `billingCycle.rateSnapshot` (frozen at cycle start per BILLING-1B)  
3. **Invoice lines** — grouped totals by line type:
   - Fixed subscription  
   - Inbound totals  
   - Outbound totals  
   - Packaging totals  
   - Quality check totals  
   - Volume charges (`excess_volume`)  
   - Weight charges (`excess_weight`)  
   - **Grand total** (`totalAmount`)  
4. **Renewal status** — cycle status, end date, days remaining, link to client billing plan  

---

## 4. Dashboard Widget

**File:** `frontend/src/components/dashboard/BillingExpiringClientsCard.tsx`

Rendered on `DashboardOverviewPage` for billing-eligible roles.

| Feature | Implementation |
|---------|----------------|
| Next 5 clients | `GET /api/billing/cycles/expiring-soon?limit=5` |
| Days remaining | Computed server-side; highlighted when ≤ 7 days |
| Renew button | `POST /api/billing/cycles/:id/renew` (admin only) |
| Client link | `/billing/plans/:companyId` |

Cycles with status `active` or `renewed` and `endsAt` in the future are ordered by soonest expiry.

---

## 5. Backend Additions

| Change | File |
|--------|------|
| Invoice detail includes cycle + lines | `billing-invoices.service.ts` — extended `INVOICE_SELECT` |
| Expiring-soon endpoint | `billing.controller.ts` — `GET /billing/cycles/expiring-soon` (registered **before** `GET /billing/cycles/:id`) |
| Expiring-soon query | `billing-cycles.service.ts` — `listExpiringSoon()` |

Existing invoice list/detail endpoints from BILLING-1A/1B are reused; no schema migration required for 2B.

---

## 6. Shared Frontend Files

| File | Purpose |
|------|---------|
| `frontend/src/api/billing.ts` | Invoice types, `listInvoices`, `getInvoice`, `listExpiringSoon` |
| `frontend/src/lib/billing-invoice-display.ts` | Filters, snapshot parse, line totals, cycle labels |
| `frontend/src/constants/query-keys.ts` | `billing.invoices`, `billing.expiringSoon` |
| `frontend/src/components/StatusBadge.tsx` | `open`, `paid` invoice status styling |

---

## 7. API Integration

| Action | Method | Endpoint |
|--------|--------|----------|
| List invoices | GET | `/billing/invoices` |
| Get invoice | GET | `/billing/invoices/:id` |
| Expiring cycles | GET | `/billing/cycles/expiring-soon?limit=5` |
| Renew cycle | POST | `/billing/cycles/:id/renew` |

---

## 8. Files Changed

| Area | Paths |
|------|-------|
| Backend | `backend/src/modules/billing/billing-invoices.service.ts`, `billing-cycles.service.ts`, `billing.controller.ts` |
| API | `frontend/src/api/billing.ts` |
| Pages | `frontend/src/pages/billing/BillingInvoicesPage.tsx`, `BillingInvoiceDetailPage.tsx` |
| Dashboard | `frontend/src/components/dashboard/BillingExpiringClientsCard.tsx`, `frontend/src/pages/DashboardOverviewPage.tsx` |
| Shared | `frontend/src/lib/billing-invoice-display.ts`, `query-keys.ts`, `section-sub-nav.ts`, `router.tsx`, `StatusBadge.tsx` |
| Report | `BILLING-2B-REPORT.md` |

---

## 9. Verification

```bash
cd backend && npm run build   # pass
cd frontend && npm run build  # pass
```

Manual smoke test checklist:

- [ ] `/billing/invoices` loads with filters and row navigation  
- [ ] Invoice detail shows snapshot, line breakdown, grand total, renewal status  
- [ ] Dashboard widget lists up to 5 expiring clients with days remaining  
- [ ] Renew from widget marks cycle `renewed` and refreshes list  

---

## 10. Git

Pushed to `staging` branch on `https://github.com/NadimHassan09/emdad-sy-3pl-wms.git`.
