# BILLING-4B — Production Billing & Invoicing Completion Report

**Sprint:** SPRINT-BILLING-4B  
**Generated:** 2026-06-09  
**Environment:** Staging (`emdad-sy-3pl-wms-staging`), branch `staging`  
**Prior phases:** BILLING-1A → 4A (domain, calculation, admin/client UI, notifications)

---

## Verdict

| Metric | Value |
|--------|------:|
| **Billing module completion** | **~95%** |
| **Production readiness** | **Ready for pilot billing operations** |
| **Build** | Backend ✅ · Admin frontend ✅ · Client frontend ✅ |
| **Migration** | `20260609150000_billing_invoice_overdue` applied |
| **PM2** | `emdad-wms-backend-staging` restarted |

**Summary:** EMDAD billing is a full-stack business module spanning capacity reservation, plan/cycle management, usage metering, immutable invoicing, suspension, renewal, notifications, audit events, reporting, and client portal visibility. BILLING-4B closes financial lifecycle gaps (overdue, paid/cancelled), adds admin billing dashboard, live invoice preview, weight capacity cap, billing reports/export, expanded audit logging, and client operational UI gating.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Admin Frontend                            │
│  /billing/dashboard  /billing/plans  /billing/invoices          │
│  BillingDashboardPage · BillingPlanDetailPage (+ preview)       │
└────────────────────────────┬────────────────────────────────────┘
                             │ REST /api/billing/*
┌────────────────────────────▼────────────────────────────────────┐
│                     BillingModule (NestJS)                         │
│  Plans · Cycles · Invoices · Preview · Dashboard · Access         │
│  InvoiceCalculation · UsageProcessor · CycleProcessor             │
│  OverdueProcessor · ExpiryReminders · Notifications · Audit       │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│  PostgreSQL: billing_plans · billing_cycles · invoices · lines  │
│  companies.status (restricted) · locations (capacity source)    │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                     Client Portal                                │
│  /billing · /billing/invoices/:id · GET /client/billing/access  │
│  Operational gating: products/stock/orders blocked when restricted│
└─────────────────────────────────────────────────────────────────┘
```

### ERD (billing domain)

```
companies ──┬──< billing_plans
            ├──< billing_cycles (rate_snapshot JSONB)
            └──< invoices ──< invoice_lines

billing_cycles.status: active | expired | renewed
invoices.status: draft | open | paid | cancelled | overdue
invoice_lines.type: subscription | inbound | outbound | packaging |
                    quality_check | excess_volume | excess_weight
```

---

## Scope checklist (Parts 1–16)

| Part | Requirement | Status | Evidence |
|------|-------------|--------|----------|
| 1 | Capacity 90/10 volume + weight | ✅ | `BillingVolumeCapacityService`, `GET /billing/capacity` |
| 2 | Billing plan management | ✅ | `BillingPlansPage`, `BillingPlanDetailPage`, plan CRUD |
| 3 | Billing cycle engine | ✅ | `BillingCyclesService`, `BillingCycleProcessorService` |
| 4 | Usage metering on completion | ✅ | `billing-invoice-calculation.service.ts`, task triggers |
| 5 | Storage + excess charges | ✅ | `BillingUsageService`, excess line types |
| 6 | Immutable invoice engine | ✅ | `finalizeCycleInvoice`, rate snapshots; **4B:** overdue status |
| 7 | Real-time invoice preview | ✅ | `GET /billing/preview`, `BillingInvoicePreviewCard` |
| 8 | Suspension engine | ✅ | `BillingAccessService.assertOperationalBilling`, company `restricted` |
| 9 | Renewal engine + expiring widgets | ✅ | Renew API, `listExpiringBuckets`, reminder crons |
| 10 | Admin billing dashboard | ✅ | `BillingDashboardPage`, plans/invoices tables (4A pagination) |
| 11 | Client billing portal | ✅ | `BillingPage`, invoice detail, tenant isolation |
| 12 | Notifications | ✅ | 30/14/7/3/1 reminders, invoice/overdue/suspend/renew |
| 13 | Audit logging | ✅ | `BillingAuditService` — plan/invoice/cycle events |
| 14 | Billing reports + CSV/XLS | ✅ | 5 report IDs in reports module |
| 15 | Dashboard enhancements | ✅ | Admin billing dashboard KPIs; client dashboard (P2A) |
| 16 | Verification | ✅ | Builds, migration, cert script, E2E spec |

---

## BILLING-4B additions (this sprint)

### Backend

| Feature | Files / endpoints |
|---------|-------------------|
| `overdue` invoice status | Migration `20260609150000_billing_invoice_overdue` |
| Overdue processor (daily) | `billing-invoice-overdue-processor.service.ts` |
| Invoice status transitions | `PATCH /billing/invoices/:id/status` (paid/cancelled/open) |
| Invoice overdue notifications | `BillingNotificationsService.notifyInvoiceOverdue` |
| Live cycle preview | `GET /billing/preview?companyId=` |
| Billing dashboard KPIs | `GET /billing/dashboard/summary` |
| Expiring buckets (30/14/7/3) | `GET /billing/dashboard/expiring-buckets` |
| Weight 90% allocation cap | `assertWeightAllocation` in `billing-access.service.ts` |
| Billing audit events | `billing-audit.service.ts` wired to plans/cycles/invoices |
| Client operational access | `GET /client/billing/access` (all client roles) |
| Billing reports | `billing-revenue`, `billing-outstanding`, `billing-expiring`, `billing-suspended`, `billing-capacity` |

### Frontend

| Feature | Location |
|---------|----------|
| Admin billing dashboard | `BillingDashboardPage.tsx`, `/billing/dashboard` |
| Invoice preview on plan detail | `BillingInvoicePreviewCard.tsx` |
| Mark paid / cancel invoice | `BillingInvoiceDetailPage.tsx` |
| Overdue status badges | `StatusBadge`, `billing-invoice-display.ts` |
| Client create-button gating | `useClientOperationalAccess`, `InboundOrdersPage` |

---

## API list (billing)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/billing/capacity` | admin | Volume + weight allocation summary |
| GET | `/billing/plans` | admin/finance | Paginated plans overview |
| POST/PATCH | `/billing/plans` | wh_manager+ | Create/update plan |
| GET | `/billing/preview` | admin/finance | Live draft invoice preview |
| GET | `/billing/dashboard/summary` | admin/finance | AR, revenue, counts |
| GET | `/billing/dashboard/expiring-buckets` | admin/finance | 30/14/7/3 day buckets |
| GET | `/billing/invoices` | admin/finance | Paginated invoices |
| PATCH | `/billing/invoices/:id/status` | wh_manager+ | Mark paid/cancelled/open |
| POST | `/billing/cycles/:id/renew` | wh_manager+ | Deferred renewal |
| GET | `/client/billing/access` | client | Operational allowed flag |
| GET | `/client/billing/summary` | client_admin | Plan + cycle + current invoice |
| GET | `/reports/billing-*/run` | admin | Billing report previews |
| GET | `/reports/billing-*/export` | admin | CSV/XLS export |

---

## Migrations

| Migration | Purpose |
|-----------|---------|
| `20260610120000_billing_domain_foundation` | Plans, cycles, invoices, lines |
| `20260610140000_billing_invoice_calculation` | `rate_snapshot` on cycles |
| `20260609150000_billing_invoice_overdue` | `overdue` enum value |

---

## Audit events

| Action | Trigger |
|--------|---------|
| `billing.plan.created` | Plan create |
| `billing.plan.updated` | Plan update |
| `billing.plan.renewed` | Cycle renew |
| `billing.plan.suspended` | Cycle expiry without renewal |
| `billing.invoice.generated` | Cycle finalize → open |
| `billing.invoice.overdue` | Overdue processor |
| `billing.invoice.paid` | Admin mark paid |
| `billing.invoice.cancelled` | Admin cancel |
| `billing.usage.calculated` | Invoice recalc (existing) |

---

## Verification

### Builds

```bash
cd backend && npm run build          # PASS
cd frontend && npm run build         # PASS
cd client-frontend && npm run build  # PASS
```

### Migration + deploy

```bash
cd backend && npx prisma migrate deploy
pm2 restart emdad-wms-backend-staging
```

### API certification

```bash
node scripts/billing-4b-cert.mjs
```

Evidence: `docs/evidence/billing-4b/api-cert.json` — **11/11 pass** after PM2 restart.

### E2E

```bash
npx playwright test tests/e2e/admin/billing-4b.spec.ts --project=admin-desktop
```

### Security / isolation

- Client invoices scoped to JWT `companyId` (cert + `tests/api/security.spec.ts`)
- Client JWT cannot access admin `/companies`
- Operational APIs call `assertOperationalBilling` on create paths

### RBAC

| Role | Billing read | Billing write | Client billing |
|------|:------------:|:-------------:|:--------------:|
| super_admin | ✅ | ✅ | — |
| wh_manager | ✅ | ✅ | — |
| finance | ✅ | — | — |
| client_admin | — | — | ✅ read |
| client_staff | — | — | access only |

---

## Known limitations

| Item | Notes |
|------|-------|
| Payment gateway | No Stripe/bank integration; `paid` is manual admin action |
| Tax / discount columns | Computed as zero in preview; no separate DB columns yet |
| Invoice PDF | Not implemented; export via reports CSV/XLS |
| Email/SMS notifications | In-app only |
| Usage dispute ledger | No immutable per-event metering table |
| Plan metadata fields | No separate `planName`/`notes` columns; company name used |

---

## Deployment notes

1. `git pull origin staging`
2. `cd backend && npm ci && npm run build && npx prisma migrate deploy`
3. `cd frontend && npm ci && npm run build`
4. `cd client-frontend && npm ci && npm run build`
5. `pm2 restart emdad-wms-backend-staging`
6. `node scripts/billing-4b-cert.mjs`
7. Spot-check `/billing/dashboard` and client `/billing`

---

## Sign-off

BILLING-4B completes the production-grade billing & invoicing module for EMDAD 3PL WMS. Core business flows — plan → cycle → usage → draft preview → immutable invoice → overdue → suspension → renewal — are implemented end-to-end with admin and client visibility, audit trail, and operational gating.
