# BILLING-2A — Admin Billing Plans UI Report

**Generated:** 2026-06-10  
**Environment:** Staging codebase (`emdad-sy-3pl-wms`)  
**Depends on:** BILLING-1A (domain), BILLING-1B (invoice engine)  
**Deliverable:** This file only

---

## Executive Summary

BILLING-2A adds the admin **Billing Plans** UI to the internal WMS frontend. Finance and warehouse admins can list billing plans with cycle context, filter by client/cycle/billing status, create and edit plans with volume validation feedback, and renew active cycles. Row click and **View** navigate to per-client detail at `/billing/plans/:clientId`.

| Capability | Status |
|------------|--------|
| List page `/billing/plans` | **Done** |
| Detail page `/billing/plans/:clientId` | **Done** |
| Filters (client, cycle, days, billing status) | **Done** |
| Table columns per spec | **Done** |
| Create / Edit / Renew | **Done** (admin roles) |
| Volume allocation panel | **Done** |
| Sidebar + RBAC | **Done** |

---

## 1. Routes

| Path | Component | Access |
|------|-----------|--------|
| `/billing/plans` | `BillingPlansPage` | `super_admin`, `wh_manager`, `finance` |
| `/billing/plans/:clientId` | `BillingPlanDetailPage` | same |

Registered in `frontend/src/router.tsx`. Route group `billing` added to `frontend/src/lib/rbac.ts` with sidebar nav item **Billing**.

**Mutations** (Create / Edit / Renew) are shown only for `super_admin` and `wh_manager`, matching backend `InternalAdminGuard`. Finance users have read-only access.

---

## 2. Page 1 — Billing Plans Table

**File:** `frontend/src/pages/billing/BillingPlansPage.tsx`

### Filters

| Filter | Implementation |
|--------|----------------|
| Client | Combobox → `companyId` (client-side filter on joined rows) |
| Cycle status | Active / Renewed / Expired / No cycle |
| Days remaining | ≤7 / 8–30 / >30 / Expired / No cycle |
| Billing status | Operational / Restricted / Inactive |

Data sources (parallel TanStack Query):

- `GET /api/billing/plans`
- `GET /api/billing/cycles`
- `GET /api/companies?includeAll=true`
- `GET /api/billing/capacity` (volume summary banner)

Rows are built client-side via `buildBillingPlanOverviewRows()` in `frontend/src/lib/billing-plan-overview.ts` (join plan + current cycle + company name/status).

### Columns

| Column | Source |
|--------|--------|
| Client | Company name |
| Cycle start / end | Current cycle `startsAt` / `endsAt` |
| Days remaining | Computed from `endsAt` |
| Cycle length | `plan.cycleLengthDays` |
| Fixed fee | `plan.fixedSubscriptionFee` |
| Reserved volume / weight | Plan reservation fields |
| Status | Cycle status + billing status badges |
| Actions | View · Edit · Renew (dropdown) |

**Row click** → `/billing/plans/:companyId`

### Volume allocation banner

`VolumeAllocationPanel` at top of list page shows warehouse-wide:

- Reserved volume/weight (plan-level on detail; list shows global capacity)
- Warehouse allocation %
- Overflow capacity remaining (from `GET /billing/capacity`)

---

## 3. Page 2 — Client Billing Plan Details

**File:** `frontend/src/pages/billing/BillingPlanDetailPage.tsx`

Route param `clientId` = company UUID (WMS tenant id).

Sections:

1. **Volume allocation** — plan reservation + global capacity metrics  
2. **Billing plan** — all rate fields and reservation  
3. **Current billing cycle** — start, end, days remaining, status  

Actions (admin):

- **Create plan** — if none exists  
- **Edit plan** — modal with note that rate changes apply to future cycles only  
- **Renew plan** — `POST /api/billing/cycles/:id/renew` when cycle is `active`  

---

## 4. Shared Components

| File | Purpose |
|------|---------|
| `frontend/src/api/billing.ts` | API client + TypeScript types |
| `frontend/src/components/billing/BillingPlanFormModal.tsx` | Create/edit form |
| `frontend/src/components/billing/VolumeAllocationPanel.tsx` | Capacity display |
| `frontend/src/lib/billing-plan-overview.ts` | Join, filter, format helpers |

---

## 5. API Integration

| Action | Method | Endpoint |
|--------|--------|----------|
| List plans | GET | `/billing/plans` |
| Get plan | GET | `/billing/plans/:id` |
| Create plan | POST | `/billing/plans` |
| Update plan | PATCH | `/billing/plans/:id` |
| List cycles | GET | `/billing/cycles` |
| Renew cycle | POST | `/billing/cycles/:id/renew` |
| Capacity summary | GET | `/billing/capacity` |

Volume validation errors (`VOLUME_ALLOCATION_EXCEEDED`) surface via toast from API error message on create/update.

---

## 6. Files Changed

| Area | Paths |
|------|-------|
| API | `frontend/src/api/billing.ts`, `frontend/src/api/client.ts`, `frontend/src/api/companies.ts` |
| Pages | `frontend/src/pages/billing/BillingPlansPage.tsx`, `BillingPlanDetailPage.tsx` |
| Components | `frontend/src/components/billing/*` |
| Lib | `frontend/src/lib/billing-plan-overview.ts` |
| Infra | `frontend/src/router.tsx`, `frontend/src/lib/rbac.ts`, `frontend/src/constants/query-keys.ts` |
| Status badge | `frontend/src/components/StatusBadge.tsx` (`restricted`) |

---

## 7. Out of Scope (BILLING-2B+)

- Invoices UI  
- Billing cycles standalone list  
- Client portal billing views  
- Server-side paginated plans overview endpoint  
