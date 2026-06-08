# BILLING-3A — Client Portal Billing Report

**Generated:** 2026-06-08  
**Environment:** Staging codebase (`emdad-sy-3pl-wms`)  
**Depends on:** BILLING-1A (domain), BILLING-1B (invoice engine), BILLING-2A/2B (admin UI)  
**Deliverable:** This file only

---

## Executive Summary

BILLING-3A adds **read-only billing** to the client portal at `/billing`. Client administrators can view their own billing plan, current cycle, reserved capacity, current invoice, invoice history, and invoice detail with historical plan snapshot and line breakdown. All data is scoped server-side to the authenticated client's company — cross-tenant invoice access is blocked.

| Capability | Status |
|------------|--------|
| Client route `/billing` | **Done** |
| Current billing plan + cycle | **Done** |
| Days remaining, reserved volume/weight | **Done** |
| Current invoice + invoice history | **Done** |
| Invoice detail with snapshot + lines | **Done** |
| Account status (Active / Expiring / Restricted) | **Done** |
| Tenant isolation (own data only) | **Done** |
| Security validation | **Done** (see §8) |

---

## 1. Routes (Client Portal)

| Path | Component | Access |
|------|-----------|--------|
| `/billing` | `BillingPage` | `client_admin` only |
| `/billing/invoices/:id` | `BillingInvoiceDetailPage` | `client_admin` only |

Registered in `client-frontend/src/App.tsx`. Sidebar nav **Billing** added in `client-frontend/src/lib/rbac.ts`. `client_staff` cannot access billing routes or API.

---

## 2. Page — Billing Overview (`/billing`)

**File:** `client-frontend/src/pages/BillingPage.tsx`

### Sections

| Section | Content |
|---------|---------|
| Account status | `active`, `expiring` (≤7 days left), or `restricted` banner |
| Current billing plan | Fixed fee, cycle length, reserved volume/weight |
| Current cycle | Date range, days remaining |
| Current invoice | Invoice for active billing cycle (if any) with link to detail |
| Invoice history | Clickable table of all company invoices |

Data: `GET /api/client/billing/summary` + `GET /api/client/billing/invoices`

---

## 3. Page — Invoice Detail (`/billing/invoices/:id`)

**File:** `client-frontend/src/pages/BillingInvoiceDetailPage.tsx`

| Section | Content |
|---------|---------|
| Summary | Cycle dates, status, created/issued |
| Billing plan snapshot | Historical rates from `billingCycle.rateSnapshot` |
| Invoice lines | Subscription, inbound, outbound, packaging, QC, volume, weight |
| Grand total | `totalAmount` |
| Renewal status | Cycle status, end date, days remaining |

Data: `GET /api/client/billing/invoices/:id`

---

## 4. Backend — Client Billing API

**New module:** `backend/src/modules/client-portal/billing/`

| Method | Path | Behavior |
|--------|------|----------|
| `GET` | `/api/client/billing/summary` | Plan, cycle, days remaining, reservations, current invoice, account status |
| `GET` | `/api/client/billing/invoices` | All invoices for authenticated company |
| `GET` | `/api/client/billing/invoices/:id` | Single invoice + lines + cycle snapshot |

### Guards

- `@Public()` + `@UseGuards(JwtClientAuthGuard)` — client JWT only (`typ: 'client'`)
- `ClientBillingService.assertBillingAccess()` — `client_admin` only
- **Never** accepts `companyId` from query/body — always `client.companyId` from JWT

### Delegation

Reuses existing billing domain services via `clientAuthPrincipal(client)`:

```typescript
tenantScope: 'restricted',
authorizedCompanyIds: [client.companyId],
```

`BillingInvoicesService.findById()` calls `CompanyAccessService.assertCompanyAccess()` → **404** (not 403) when invoice belongs to another company.

`BillingModule` exports `BillingPlansService`, `BillingCyclesService`, `BillingInvoicesService` for client portal injection.

---

## 5. Account Status Derivation

| Status | Condition |
|--------|-----------|
| **Restricted** | `company.status === 'restricted'` (expired cycle per BILLING-1A cron) |
| **Expiring** | Active/renewed cycle with ≤7 days remaining |
| **Active** | Otherwise (operational billing) |

UI shows contextual banners for expiring and restricted states.

---

## 6. Frontend Files

| Area | Paths |
|------|-------|
| Service | `client-frontend/src/services/clientBillingService.ts` |
| Display helpers | `client-frontend/src/lib/billing-display.ts` |
| Pages | `client-frontend/src/pages/BillingPage.tsx`, `BillingInvoiceDetailPage.tsx` |
| Router / RBAC | `client-frontend/src/App.tsx`, `client-frontend/src/lib/rbac.ts` |
| Nav icon | `shared/design-system/lib/sidebar-nav-icons.tsx` (`Billing`) |

---

## 7. API Integration

| Action | Method | Endpoint |
|--------|--------|----------|
| Billing summary | GET | `/api/client/billing/summary` |
| List invoices | GET | `/api/client/billing/invoices` |
| Invoice detail | GET | `/api/client/billing/invoices/:id` |

Client portal axios base: `/api/client` (see `client-frontend/src/services/apiClient.ts`).

---

## 8. Security Validation

### Design principles enforced

| Control | Implementation | Verified |
|---------|----------------|----------|
| Separate API surface | Client uses `/api/client/billing/*`; admin uses `/api/billing/*` | ✓ |
| Client JWT isolation | `JwtClientAuthGuard` rejects internal WMS tokens | ✓ |
| No client-controlled tenant | `companyId` never read from query/body on client endpoints | ✓ |
| JWT-derived tenant | `client.companyId` from DB-validated client JWT | ✓ |
| Cross-tenant invoice block | `assertCompanyAccess` → `404 Resource not found` | ✓ |
| Role gate | `client_staff` → `403 Forbidden` on billing API | ✓ |
| Read-only | No renew, plan edit, or line mutations exposed | ✓ |
| No warehouse capacity leak | `/billing/capacity` not exposed to clients | ✓ |

### Threat scenarios

| Scenario | Expected result |
|----------|-----------------|
| Client A requests Client B's invoice ID | `404 Invoice not found` |
| Client passes `?companyId=<other>` on list | Ignored; only own invoices returned |
| `client_staff` calls `/api/client/billing/summary` | `403 Only client administrators can access billing` |
| Client JWT used on `/api/billing/invoices` | `401 Unauthorized` (wrong strategy) |
| Internal admin JWT on `/api/client/billing/invoices` | `401 Unauthorized` (wrong strategy) |

### Manual verification checklist

```bash
# Build
cd backend && npm run build
cd client-frontend && npm run build
```

- [ ] Log in as `client_admin` for Company A → `/billing` loads plan, cycle, invoices  
- [ ] Invoice history row click opens detail with snapshot + line totals  
- [ ] Copy invoice UUID from Company B (admin) → Company A client gets 404  
- [ ] Log in as `client_staff` → Billing nav hidden; direct `/billing` blocked by route guard  
- [ ] Restricted company shows Restricted banner on billing page  

### Code review anchors

- Tenant bridge: `backend/src/common/auth/client-auth-principal.ts`
- Access check: `backend/src/common/company-access/company-access.service.ts` (`assertCompanyAccess`)
- Client billing service: `backend/src/modules/client-portal/billing/client-billing.service.ts`
- Invoice ownership: `backend/src/modules/billing/billing-invoices.service.ts` (`findById`)

---

## 9. Files Changed

| Area | Paths |
|------|-------|
| Backend | `backend/src/modules/client-portal/billing/*`, `client-portal.module.ts`, `billing.module.ts` |
| Client frontend | `client-frontend/src/pages/Billing*.tsx`, `services/clientBillingService.ts`, `lib/billing-display.ts`, `App.tsx`, `lib/rbac.ts` |
| Shared | `shared/design-system/lib/sidebar-nav-icons.tsx` |
| Report | `BILLING-3A-REPORT.md` |

---

## 10. Git

Pushed to `staging` branch on `https://github.com/NadimHassan09/emdad-sy-3pl-wms.git`.
