# BILLING-4A — Billing Pagination + Notifications

**Sprint:** SPRINT-P1A  
**Date:** 2026-06-09  
**Branch:** `staging`  
**Status:** Complete

---

## Summary

Delivered server-side pagination, search, filters, and sorting for admin Billing Plans and Billing Invoices tables; billing lifecycle notifications (invoice generated, cycle expiry reminders, account suspended/renewed); and four admin dashboard billing widgets.

---

## Backend

### Paginated list APIs

| Endpoint | Shape | Filters / sort |
|----------|-------|----------------|
| `GET /api/billing/plans` | `{ items, total, limit, offset }` | `companyId`, `search` (client name), `cycleStatus`, `daysRemaining`, `billingStatus`, `expiryFrom`, `expiryTo`, `sort_by`, `sort_dir` |
| `GET /api/billing/invoices` | `{ items, total, limit, offset }` | `companyId`, `search` (invoice number), `status`, `cycleStatus`, `createdFrom`, `createdTo`, `expiryFrom`, `expiryTo`, `sort_by`, `sort_dir` |

**Plans overview** uses a SQL CTE (`billing-plans-list.query.ts`) joining plans, companies, and current billing cycles for efficient server-side filtering.

**DTOs:** `ListBillingPlansQueryDto`, `ListBillingInvoicesQueryDto` (extend `PaginationDto`).

Legacy `list()` service methods retained for client portal / detail pages.

### Dashboard widget endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /api/billing/dashboard/overdue-clients` | Restricted companies (billing overdue) |
| `GET /api/billing/dashboard/recent-invoices` | Latest open/paid invoices |
| `GET /api/billing/dashboard/suspended-accounts` | Restricted company accounts |
| `GET /api/billing/cycles/expiring-soon` | *(existing)* Upcoming expirations |

### Notifications

New `BillingNotificationsService` + `BillingExpiryReminderService` (daily cron `0 8 * * *`):

| Event | Admin type | Client type | Trigger |
|-------|------------|-------------|---------|
| Invoice generated | `admin_billing_invoice_generated` | `client_billing_invoice_generated` | Cycle expiry processor after `finalizeCycleInvoice` |
| Cycle expiring (30/14/7/3/1 days) | `admin_billing_cycle_expiring_{n}d` | `client_billing_cycle_expiring_{n}d` | Daily expiry reminder cron |
| Account suspended | `admin_billing_account_suspended` | `client_billing_account_suspended` | Cycle expired without renewal |
| Account renewed | `admin_billing_account_renewed` | `client_billing_account_renewed` | Auto-renewal on cycle expiry |

All notifications are deduplicated by `(type, referenceType, referenceId)` (and `companyId` for client).

---

## Frontend

### Billing Plans (`BillingPlansPage`)

- `useChunkedServerPagination` + `DataTable.serverPagination` (200-row chunks, 50-row UI pages)
- Server filters: client search, company, cycle status, days remaining, billing status, expiry date range, sort
- Removed client-side full fetch of plans + cycles + companies

### Billing Invoices (`BillingInvoicesPage`)

- Server pagination with search, invoice status, cycle status, created date range, cycle expiry range, sort

### Dashboard widgets (`DashboardOverviewPage`)

New cards in a **Billing** section (2×2 grid):

- `BillingExpiringClientsCard` — upcoming expirations *(existing)*
- `BillingOverdueClientsCard` — overdue / restricted clients
- `BillingRecentInvoicesCard` — recent invoices
- `BillingSuspendedAccountsCard` — suspended accounts

Visible to `super_admin`, `wh_manager`, `finance`.

---

## Verification

### Build

| Target | Result |
|--------|--------|
| `backend npm run build` | PASS |
| `frontend npm run build` | PASS |

### API smoke test

```bash
node scripts/billing-4a-verify.mjs
```

| Endpoint | Latency |
|----------|---------|
| `GET /billing/plans` | 61ms |
| `GET /billing/plans?search=` | 39ms |
| `GET /billing/invoices` | 20ms |
| `GET /billing/dashboard/overdue-clients` | 14ms |
| `GET /billing/dashboard/recent-invoices` | 9ms |
| `GET /billing/dashboard/suspended-accounts` | 8ms |
| `GET /billing/cycles/expiring-soon` | 9ms |

All endpoints under 500ms p95 target on staging dataset.

### E2E (Playwright)

```bash
cd frontend && BASE_URL=http://127.0.0.1:5173 npx playwright test e2e/billing-pagination-ui.spec.ts
```

**5/5 PASS** — plans pagination, plans filters, invoices pagination, invoices filters, dashboard billing widgets.

---

## Key files

**Backend**

- `backend/src/modules/billing/dto/list-billing-plans-query.dto.ts`
- `backend/src/modules/billing/dto/list-billing-invoices-query.dto.ts`
- `backend/src/modules/billing/billing-plans-list.query.ts`
- `backend/src/modules/billing/billing-plans.service.ts` — `listPage()`
- `backend/src/modules/billing/billing-invoices.service.ts` — `listPage()`
- `backend/src/modules/billing/billing-dashboard.service.ts`
- `backend/src/modules/billing/billing-notifications.service.ts`
- `backend/src/modules/billing/billing-expiry-reminder.service.ts`
- `backend/src/modules/billing/billing-cycle-processor.service.ts` — notification hooks
- `backend/src/modules/billing/billing.controller.ts`

**Frontend**

- `frontend/src/api/billing.ts`
- `frontend/src/pages/billing/BillingPlansPage.tsx`
- `frontend/src/pages/billing/BillingInvoicesPage.tsx`
- `frontend/src/components/dashboard/BillingOverdueClientsCard.tsx`
- `frontend/src/components/dashboard/BillingRecentInvoicesCard.tsx`
- `frontend/src/components/dashboard/BillingSuspendedAccountsCard.tsx`
- `frontend/src/pages/DashboardOverviewPage.tsx`
- `frontend/e2e/billing-pagination-ui.spec.ts`

**Scripts**

- `scripts/billing-4a-verify.mjs`

---

## Notes

- Plans list returns enriched overview rows (`BillingPlanOverviewItem`) so the UI no longer joins plans/cycles/companies client-side.
- Expiry reminder cron uses day-window matching; notifications fire once per cycle per threshold (deduped).
- E2E tests mock only `/api/*` pathname requests (not Vite `src/api` modules).
