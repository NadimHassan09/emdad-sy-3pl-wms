# CLIENT-PORTAL-2 — Client Portal Completion Report

**Sprint:** SPRINT-P2A  
**Generated:** 2026-06-09  
**Environment:** Staging (`emdad-sy-3pl-wms-staging`), branch `staging`  
**Prior work:** CLIENT-UX-1 (dashboard KPIs), BILLING-3A (client billing read-only)

---

## Verdict

| Metric | Value |
|--------|------:|
| **Client portal completion** | **~95%** (up from ~85%) |
| **P2A scope delivered** | **100%** |
| **Data isolation** | **Pass** — company scoped via JWT |
| **E2E coverage** | **Extended** — dashboard, billing, notifications |

**Summary:** Client portal now has a dedicated notifications page with pagination, enhanced dashboard KPIs (stock volume, recent invoices, empty states), billing widgets and invoice history filters, and consistent `EmptyState` usage. All changes are company-scoped; no cross-tenant leakage observed in certification.

---

## Deliverables

| Item | Status | Location |
|------|--------|----------|
| Notifications page | ✅ | `client-frontend/src/pages/NotificationsPage.tsx` |
| Notifications pagination API | ✅ | `GET /api/client/notifications?limit&offset` |
| Dashboard stock volume card | ✅ | `DashboardPage.tsx` |
| Dashboard recent invoices | ✅ | `ClientRecentInvoicesCard.tsx` |
| Billing widgets | ✅ | `BillingPage.tsx` stat row |
| Invoice history filter + issued date | ✅ | `BillingPage.tsx` + `listInvoicesPage` status param |
| Empty state improvements | ✅ | Dashboard, Billing, Notifications |
| Data isolation cert | ✅ | `scripts/client-portal-2-cert.mjs` |
| E2E tests | ✅ | `tests/e2e/client/client-portal-2.spec.ts` |
| Screen coverage | ✅ | `tests/e2e/client/screens-coverage.spec.ts` |
| API catalog | ✅ | `tests/helpers/endpoint-catalog.ts` |
| Evidence | ✅ | `docs/evidence/client-portal-2/api-cert.json` |

---

## Feature Inventory

### Dashboard cards (all implemented)

| Card | Client admin | Client staff | Notes |
|------|:------------:|:------------:|-------|
| Active orders | ✅ | ✅ | Sum of open inbound + outbound |
| Inbound orders | ✅ | ✅ | Links to `/inbound-orders` |
| Outbound orders | ✅ | ✅ | Links to `/outbound-orders` |
| Products | ✅ | ✅ | Count visible to staff; CRUD nav admin-only |
| Stock volume | ✅ | ✅ | Dedicated CBM + weight hint |
| Storage utilization | ✅ | ✅ | Progress bar when plan reserved volume exists |
| Billing cycle countdown | ✅ | — | Admin-only billing section |
| Current invoice amount | ✅ | — | Admin-only |
| Recent invoices | ✅ | — | Last 5 from overview API |
| Empty state (zero activity) | ✅ | ✅ | CTA to create inbound order |

### Notifications

- **Topbar bell** — unchanged; now includes **View all** → `/notifications`
- **Sidebar nav** — Notifications item for admin and staff
- **Page** — paginated list (20/page), All/Unread/Read filters, mark-read on click, mark-all-read
- **Deep links** — inbound/outbound orders, billing cycle → `/billing`

### Billing

- **Summary widgets** — days until renewal, current invoice amount, total invoice count
- **Invoice history** — status filter (draft/open/paid/cancelled), issued date column, contextual empty states
- **Plan / cycle empty states** — `EmptyState` when no plan or current invoice

---

## API Changes

### `GET /api/client/notifications`

Response now includes pagination metadata:

```json
{
  "items": [],
  "unreadCount": 0,
  "total": 42,
  "limit": 20,
  "offset": 0
}
```

### `GET /api/client/dashboard/overview`

New field:

```json
{
  "recentInvoices": [
    {
      "id": "...",
      "invoiceNumber": "INV-...",
      "status": "open",
      "totalAmount": "1500.00",
      "issuedAt": null,
      "createdAt": "2026-06-01T00:00:00.000Z"
    }
  ]
}
```

`productsCount` is now returned for **all** client roles (read-only KPI).

### `GET /api/client/billing/invoices`

Optional `status` query param for server-side filtering.

---

## Verification

### Data isolation (`scripts/client-portal-2-cert.mjs`)

| Check | Result |
|-------|--------|
| Client stock rows scoped to JWT company | Pass |
| Client JWT blocked from admin `/companies` | Pass |
| Cross-tenant stock ID overlap (Acme vs Nahdi) | Pass / skip if Nahdi user absent |
| Dashboard overview 200 | Pass |
| Notifications pagination metadata | Pass |
| Billing summary + invoices 200 | Pass |

Evidence: `docs/evidence/client-portal-2/api-cert.json`

### E2E (`tests/e2e/client/client-portal-2.spec.ts`)

- Dashboard KPI widgets visible
- Recent invoices section visible (client admin)
- Billing widgets + invoice history
- Notifications page with filter tabs
- Topbar "View all" → `/notifications`

### UX review

| Area | Assessment |
|------|------------|
| Dashboard density | Good — 11 KPI cards + recent invoices panel |
| Empty states | Improved — contextual copy + CTAs |
| Notifications | Complete — matches admin bell pattern with full page |
| Billing | Improved — quick stats reduce scroll to find cycle info |
| Arabic labels | Present on all new strings |
| Staff vs admin | Billing/recent invoices correctly gated |

---

## Files Changed (summary)

**Backend**
- `client-notifications.service.ts` — offset/total pagination
- `client-notifications.controller.ts` — offset query
- `client-dashboard.service.ts` — recentInvoices, productsCount for all roles
- `client-billing.service.ts` — invoice status filter
- `client-billing.controller.ts` — status query param

**Client frontend**
- `NotificationsPage.tsx` (new)
- `ClientRecentInvoicesCard.tsx` (new)
- `DashboardPage.tsx`, `BillingPage.tsx`, `App.tsx`, `rbac.ts`, `PortalLayout.tsx`
- Service types for pagination + overview

**Design system**
- `TopbarNotifications.tsx` — optional View all footer
- `sidebar-nav-icons.tsx` — Dashboard + Notifications icons

**Tests & tooling**
- `tests/e2e/client/client-portal-2.spec.ts`
- `tests/e2e/client/screens-coverage.spec.ts`
- `tests/helpers/endpoint-catalog.ts`
- `scripts/client-portal-2-cert.mjs`

---

## Remaining gaps (out of P2A scope)

| Gap | Priority |
|-----|----------|
| Real-time invalidation on notifications page when bell receives event | Low |
| Push/email notification channels for clients | Future |
| Billing PDF download from client portal | Medium |
| Client staff billing read-only (finance policy decision) | Product |

---

## Sign-off

SPRINT-P2A Client Portal Completion is **ready for staging deployment**. Run:

```bash
node scripts/client-portal-2-cert.mjs
npx playwright test tests/e2e/client/client-portal-2.spec.ts --project=client-desktop
```
