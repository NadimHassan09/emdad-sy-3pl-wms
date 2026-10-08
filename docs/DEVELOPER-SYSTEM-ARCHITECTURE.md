# Developer / System Architecture Documentation

**Audience:** developers who need to change the system.  
**Companion document:** [DATA-ACCESS-AND-REPORTING.md](./DATA-ACCESS-AND-REPORTING.md) — how to query and export data.

This is a map of the **implemented** codebase (not the original Phase 1 blueprint). Paths are relative to the repository root.

---

## How to use this document

| Question | Jump to |
|----------|---------|
| Change the OMS Orders page | [OMS Orders](#module-oms-orders) |
| Change Bulk Shipping | [Shipping & Bulk Shipping](#module-shipping--bulk-shipping) |
| Add a shipping provider | [How to add a shipping provider](#how-to-add-a-shipping-provider) |
| Change billing calculation | [Billing](#module-billing) |
| Add a new OMS order status | [How to add an OMS order status](#how-to-add-an-oms-order-status) |
| Change the database | [Database, schema, migrations](#database-schema-migrations) |
| Change auth / roles | [Authentication, authorization, RBAC](#authentication-authorization-rbac) |
| Change client portal | [Client portal](#module-client-portal) |
| Call the external REST API | [External API](#module-external-api) |

---

## 1. Technologies and frameworks

| Layer | Stack (as implemented) |
|-------|------------------------|
| Admin UI | React 18, Vite 6, TypeScript, Tailwind 3, React Router 6, TanStack Query 5, Axios, Socket.IO client, Recharts, Leaflet |
| Client portal UI | React 19, Vite 8, TypeScript, Tailwind 3, React Router 7, TanStack Query 5, Axios, Socket.IO client |
| Shared UI | `shared/design-system-next` imported as `@ds` |
| Backend | NestJS 11, Prisma 5, PostgreSQL, Passport JWT, class-validator, Socket.IO, ioredis (optional), Puppeteer (PDFs), Handlebars, Sharp, xlsx |
| Process | PM2. Staging: `ecosystem.staging.config.js` → process `emdad-wms-backend-staging` on **port 3001** |
| Auth | Internal JWT (`typ: internal`) + client JWT (`typ: client`) + API keys (`X-API-Key` / `X-API-Secret`) |
| Realtime | Socket.IO namespace `/realtime`; Redis adapter when Redis is enabled |

**Global API prefix:** `/api` (`backend/src/main.ts`).

**Staging surfaces:** admin `staging-admin.emdadsy.com`, client `staging-client.emdadsy.com`, API on port `3001`.

---

## 2. Overall architecture

The system is a **modular monolith**: one NestJS backend, two SPAs, one PostgreSQL database.

```
Admin SPA (frontend/)          Client SPA (client-frontend/)
  React + TanStack Query         React + TanStack Query
           \                       /
            \  HTTPS / cookies    /
             v                   v
              NestJS  /api
         ┌────────┴────────┐
         │  JwtAuthGuard   │  (default; @Public() for client + API keys)
         │  Feature modules│
         └────────┬────────┘
                  │
     PostgreSQL (Prisma)     Redis (optional cache + Socket.IO)
     Filesystem (PDFs, media, backups)
                  │
         External: Babel Express, Google OAuth, Google Drive
```

**How the main parts communicate**

1. Admin UI calls `/api/*` with the internal JWT (cookie `access_token` or Bearer). Tenant selection uses header `X-Company-Id` or query `companyId`.
2. Client UI calls `/api/client/*` with the client JWT (cookie `client_access_token`). Always scoped to the user’s `companyId`.
3. Merchant integrations call `/api/v1/{oms|inbound|outbound}/*` with API key + secret.
4. Warehouse fulfillment is a **separate** `OutboundOrder`. An `OmsOrder` is linked via `oms_orders.outbound_order_id` when admin confirms/approves (or admin creates with outbound provision).
5. Carrier booking writes `carrier_shipments` against the outbound order.
6. Billing cycles count inbound/outbound orders and write `invoices` / `invoice_lines`.
7. Socket.IO pushes cache-invalidation events to both SPAs.

**OMS → warehouse handoff (implemented)**

- Client create → `OmsOrder` status `waiting_for_confirmation` (no outbound yet).
- Client confirm → `confirmed_waiting_for_admin_approval`.
- Admin confirm (from waiting) or admin approve → `processing` **and** `OmsOutboundSyncService.createOutboundFromOms()`.
- Outbound warehouse stages sync back to OMS via `mapOutboundStatusToOms()` in `oms-order.mapper.ts`.
- Delivered is **not** auto-synced; admin marks delivered.

---

## 3. Repository folder structure

| Path | Responsibility |
|------|----------------|
| `backend/` | NestJS API, Prisma schema/migrations, crons, PDFs |
| `frontend/` | Admin / warehouse SPA |
| `client-frontend/` | Merchant / client portal SPA |
| `shared/design-system-next/` | Shared React primitives (`@ds`) |
| `shared/syria-locations/` | Static Syria address hierarchy |
| `packages/wms-task-execution/` | Shared task-execution helpers (also vendored in front/back) |
| `landing-page/` | Static marketing page (not part of either SPA) |
| `docs/` | Developer and ops documentation (this file lives here) |
| `QA-DOCUMENTATION/` | QA / business-rule notes |
| `deploy/`, `docker/`, `scripts/` | Deploy, compose, operational scripts |
| `ecosystem.config.js` | Production PM2 |
| `ecosystem.staging.config.js` | Staging PM2 (port 3001) |
| `tests/` | Repo-level QA automation |

Ignore `node_modules/`, `dist/`, and root `*-REPORT.md` / `*-CERTIFICATION.md` files unless you are investigating a past release.

---

## 4. Backend layout

### 4.1 `backend/src`

| Path | Purpose |
|------|---------|
| `main.ts` | Bootstrap, CORS, global prefix `/api`, pipes, static media |
| `app.module.ts` | Wires all feature modules + global JWT guard |
| `common/` | Auth/RBAC, Prisma, Redis, tenant access, audit, env validation, filters |
| `modules/` | One folder per domain (see below) |
| `pdf/` | PDF generation + `DocumentsController` |
| `data/syria-locations/` | Server-side geo JSON |
| `vendor/wms-task-execution/` | Task completion helpers |

### 4.2 `backend/src/common` (important files)

| File | Purpose |
|------|---------|
| `auth/rbac-policy.ts` | Role → capability policy |
| `auth/roles.decorator.ts` | `@Roles(AuthGroup.ADMIN \| OPERATOR)` |
| `auth/roles.guard.ts` | Enforces `@Roles` |
| `auth/internal-admin.guard.ts` | `super_admin` + `wh_manager` only |
| `auth/super-admin.guard.ts` | `super_admin` only |
| `auth/public.decorator.ts` | Skip global JWT |
| `auth/current-user.decorator.ts` | `@CurrentUser()` |
| `company-access/company-access.service.ts` | Tenant scoping |
| `prisma/prisma.service.ts` | Prisma client |
| `config/env.validation.ts` | Zod env schema (source of truth for env names) |
| `dto/pagination.dto.ts` | Default `limit=50`, max `500` |
| `audit/audit-log.service.ts` | Mutation audit writes |
| `cron/` | Leader election so only one PM2 instance runs crons |

### 4.3 Feature modules (`backend/src/modules/`)

| Folder | Domain |
|--------|--------|
| `auth/` | Internal login, refresh, Google OAuth, avatars |
| `users/` | Internal + client user admin |
| `companies/` | Client tenants + lifecycle |
| `warehouses/`, `locations/` | Warehouse master data |
| `products/` | SKU catalog |
| `inventory/` | Stock, ledger, availability, internal transfer |
| `inbound/` | Inbound orders |
| `outbound/` | Warehouse outbound / shipping stages |
| `oms/` | Commercial OMS orders + outbound sync + sales-channel stubs |
| `oms-returns/` | Commercial returns |
| `returns/` | Warehouse return orders |
| `cod/` | COD records |
| `shipping/` | Carriers, quotes, Babel, bulk shipping |
| `billing/` | Plans, cycles, invoices, charge engine |
| `client-portal/` | Client JWT APIs + external API + import/export |
| `reports/` | Report framework (20 report IDs) |
| `dashboard/` | Admin dashboard |
| `warehouse-workflow/` | Tasks, workflows, workers, SLA, analytics |
| `cycle-count/`, `adjustments/` | Inventory control |
| `notifications/`, `realtime/` | In-app + Socket.IO |
| `backups/` | Backup/restore/Google Drive |
| `audit-logs/` | Audit log query/export |
| `final-contracts/`, `forms/` | Contracts + landing-page leads |
| `media/` | Image storage (no dedicated HTTP controller) |
| `observability/` | `/api/ops` health |
| `orders/` | Shared execution-plan utilities (no HTTP controller) |

---

## 5. Admin frontend layout (`frontend/src`)

| Path | Purpose |
|------|---------|
| `router.tsx` | All admin routes |
| `main.tsx` | App bootstrap |
| `api/` | One Axios client per domain |
| `pages/` | Route screens |
| `components/` | Shared + per-module UI |
| `auth/` | `RequireAuth`, `RequireRouteAccess`, `AuthContext` |
| `lib/rbac.ts` | Nav + path access by role |
| `lib/oms-commercial-status.ts` | OMS status labels / colors |
| `lib/reports/` | Report catalog + hooks |
| `hooks/` | Pagination, filters, warehouse, notifications |
| `realtime/` | Socket.IO cache invalidation |
| `workflow/` | Task UI matrix |

**Admin API clients** — `frontend/src/api/`

| File | Backend prefix |
|------|----------------|
| `oms.ts` | `/oms`, `/cod`, `/oms/returns` |
| `outbound.ts` | `/outbound-orders` |
| `inbound.ts` | `/inbound-orders` |
| `shipping.ts` | `/shipping` including `/shipping/bulk/*` |
| `billing.ts` | `/billing` |
| `reports.ts` | `/reports/:reportId/*` |
| `inventory.ts`, `products.ts`, `companies.ts`, `users.ts`, `tasks.ts`, `warehouses.ts`, `locations.ts`, `dashboard.ts`, `auth.ts`, `backups.ts`, `audit-logs.ts`, `cycle-count.ts`, `returns.ts`, `documents.ts`, `final-contracts.ts`, `forms.ts`, `workers.ts`, `workflows.ts` | matching `/api` prefixes |

---

## 6. Client frontend layout (`client-frontend/src`)

| Path | Purpose |
|------|---------|
| `App.tsx` | Routes |
| `services/` | Axios clients (base `/api/client`) |
| `pages/` | Portal screens |
| `components/PortalLayout.tsx` | Shell + nav |
| `lib/rbac.ts` | `client_admin` vs `client_staff` |
| `auth/` | Client JWT guards |

OMS in the client portal is labeled **Ecommerce orders** (`/ecommerce-orders`).

---

## 7. Database, schema, migrations

| What | Where |
|------|-------|
| Prisma schema (source of truth for models) | `backend/prisma/schema.prisma` |
| Migrations | `backend/prisma/migrations/` (~89 folders; baseline `0_init`) |
| Seed | `backend/prisma/seed.ts` |
| Prisma client | generated into `backend/node_modules/.prisma/client` |
| Env connection | `DATABASE_URL` in `backend/.env` |

**To change the database structure**

1. Edit `backend/prisma/schema.prisma` (model + `@@map` table name).
2. Create a migration under `backend/prisma/migrations/<timestamp>_<name>/migration.sql`.
3. Run on **staging only**: `cd backend && npx prisma migrate deploy && npx prisma generate`.
4. Update DTOs, services, and any frontend types that assume the old shape.
5. If the change is an enum used in UI (status, role), also update frontend unions (`frontend/src/api/*.ts`, `lib/*-status.ts`, client `lib/` labels).

Do **not** edit production (`/var/www/emdad-sy-3pl-wms`) unless explicitly requested.

---

## 8. Authentication, authorization, RBAC

### Where it lives

| Concern | File |
|---------|------|
| Internal login | `backend/src/modules/auth/auth.service.ts`, `auth.controller.ts` |
| Internal JWT strategy | `backend/src/modules/auth/strategies/jwt.strategy.ts` |
| Global guard | `backend/src/modules/auth/guards/jwt-auth.guard.ts` (registered in `app.module.ts`) |
| Client login | `backend/src/modules/client-portal/auth/` |
| API keys | `backend/src/modules/client-portal/external-api/api-key.guard.ts` |
| Role groups | `backend/src/common/auth/roles.decorator.ts` + `roles.guard.ts` |
| Admin nav / route lock | `frontend/src/lib/rbac.ts` + `frontend/src/auth/RequireRouteAccess.tsx` |
| Client nav / route lock | `client-frontend/src/lib/rbac.ts` |

### Roles (`UserRole` in schema)

**Internal:** `super_admin`, `wh_manager`, `wh_operator`, `finance`  
**Client:** `client_admin`, `client_staff`

**Auth groups:** `ADMIN` = super_admin + wh_manager + finance; `OPERATOR` = wh_operator.

**Layered checks**

1. Authenticate (JWT unless `@Public()`).
2. Optional `@Roles(...)`.
3. Optional `InternalAdminGuard` / `SuperAdminGuard`.
4. Tenant filter via `CompanyAccessService`.
5. Client routes: `@Public()` + `JwtClientAuthGuard`.
6. External API: `@Public()` + `ApiKeyGuard` + `@RequireApiScope(...)`.

---

## 9. Configuration and environment

| File | Purpose |
|------|---------|
| `backend/.env` | Runtime secrets (do not commit) |
| `backend/src/common/config/env.validation.ts` | Allowed env var names |
| `frontend/.env` / `.env.example` | `VITE_API_URL` |
| `client-frontend/.env` / `.env.example` | `VITE_API_URL` → `/api/client` |
| `frontend/vite.config.ts` | Dev proxy, `OMS_COD_RETURNS_UI_ENABLED` |
| `ecosystem.staging.config.js` | Staging PM2 + `PORT=3001` |

Important backend env **names** (not values): `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `CLIENT_JWT_SECRET`, `CORS_ORIGINS`, `REDIS_ENABLED`, `ALLOCATE_ON_ORDER_CREATE`, `DOCUMENT_STORAGE_DIR`, `MEDIA_STORAGE_DIR`, `BACKUP_*`, `GOOGLE_OAUTH_*`.

---

## 10. Shared / reusable UI and utilities

| Location | What |
|----------|------|
| `shared/design-system-next/ui/` | AppShell, Sidebar, Card, Button, etc. (`@ds`) |
| `frontend/src/components/AdminListPageShell.tsx` | Standard admin list page |
| `frontend/src/components/DataTable.tsx`, `FilterPanel.tsx`, `ServerPaginationBar.tsx` | Lists |
| `frontend/src/components/CascadingAddressSelector.tsx` | Governorate / city / neighborhood |
| `frontend/src/hooks/useChunkedServerPagination.ts`, `useFilters.ts` | List state |
| `backend/src/common/utils/` | Shared backend helpers |
| `backend/src/common/dto/pagination.dto.ts` | List pagination |

---

## 11. External integrations

| Integration | Implemented in | Status |
|-------------|----------------|--------|
| **Babel Express** (quotes, AWB, geo, labels) | `backend/src/modules/shipping/providers/babel-express/` | Live |
| **Google OAuth** (admin login) | `backend/src/modules/auth/google-oauth.service.ts` | Live |
| **Google Drive backups** | `backend/src/modules/backups/` | Live |
| **Sales channels** (Shopify / Woo / Salla / Zid) | `backend/src/modules/oms/sales-channels/` | Webhook stub; does **not** create OMS orders yet |
| **Landing form** | `POST /api/forms/submit` (`modules/forms/`) | Public |

---

# Module maps

For each module: frontend files, backend files, database, services, APIs. This is the “where do I go?” section.

---

## Module: OMS Orders

Commercial orders. Client calls them “Ecommerce orders”.

### Frontend (admin)

| Path | Purpose |
|------|---------|
| `frontend/src/pages/OmsOrdersListPage.tsx` | **OMS Orders list** (`/orders/oms`) |
| `frontend/src/pages/OmsOrderDetailPage.tsx` | Detail + confirm / reject / allocate / deliver |
| `frontend/src/pages/OmsOrderCreatePage.tsx` | Create (`/orders/oms/new`) |
| `frontend/src/pages/OmsDashboardPage.tsx` | OMS KPIs (`/oms/dashboard`) |
| `frontend/src/components/oms/OmsOrderFormModal.tsx` | Create/edit form + address validation |
| `frontend/src/components/oms/OmsOrdersImportModal.tsx` | CSV import |
| `frontend/src/components/oms/OmsOrdersExportModal.tsx` | CSV export |
| `frontend/src/components/oms/OmsStatusBadge.tsx` | Status chip |
| `frontend/src/components/oms/OmsOrderTrackingPanel.tsx` | Timeline stepper |
| `frontend/src/lib/oms-commercial-status.ts` | Labels, colors, filter options |
| `frontend/src/api/oms.ts` | `OmsApi` client |

### Frontend (client)

| Path | Purpose |
|------|---------|
| `client-frontend/src/pages/EcommerceOrdersPage.tsx` | List (`/ecommerce-orders`) |
| `client-frontend/src/pages/CreateEcommerceOrderPage.tsx` | Create |
| `client-frontend/src/pages/EcommerceOrderDetailPage.tsx` | Detail + confirm/cancel |
| `client-frontend/src/services/clientOmsOrdersService.ts` | API client |

### Backend

| Path | Purpose |
|------|---------|
| `backend/src/modules/oms/oms.controller.ts` | Admin HTTP routes |
| `backend/src/modules/oms/oms-orders.service.ts` | **Main create / confirm / approve / cancel / deliver logic** |
| `backend/src/modules/oms/oms-order-transitions.ts` | **State machine allow-list** |
| `backend/src/modules/oms/oms-outbound-sync.service.ts` | Create/sync linked `OutboundOrder` |
| `backend/src/modules/oms/oms-order.mapper.ts` | Serialization + outbound→OMS status map |
| `backend/src/modules/oms/oms-order-events.service.ts` | Timeline events |
| `backend/src/modules/oms/order-allocation.service.ts` | Stock reservation |
| `backend/src/modules/oms/oms-orders-csv.service.ts` | Admin CSV |
| `backend/src/modules/oms/oms-orders-list-where.ts` | List filters |
| `backend/src/modules/oms/dto/oms-order.dto.ts` | Create/update DTO |
| `backend/src/modules/oms/dto/list-oms-orders-query.dto.ts` | List query params |
| `backend/src/modules/client-portal/oms/client-oms-orders.controller.ts` | Client HTTP |
| `backend/src/modules/client-portal/oms/dto/create-client-oms-order.dto.ts` | Client create (address required) |

### Database

| Model / table | Purpose |
|---------------|---------|
| `OmsOrder` / `oms_orders` | Commercial header |
| `OmsOrderLine` / `oms_order_lines` | Lines + prices |
| `OmsOrderEvent` / `oms_order_events` | Status history / timeline |
| `StockReservation` / `stock_reservations` | Allocation holds (on outbound) |

### Key APIs (admin, prefix `/api`)

| Endpoint | What it does |
|----------|----------------|
| `GET /oms/orders` | List (filters: `companyId`, `status`, `createdFrom`, `createdTo`, `orderSearch`, `city`, `linkStatus`, …) |
| `POST /oms/orders` | Admin create (provisions outbound → status `processing`) |
| `GET /oms/orders/:id` | Detail |
| `PATCH /oms/orders/:id` | Edit |
| `POST /oms/orders/:id/confirm` | Admin confirm → processing + outbound |
| `POST /oms/orders/:id/approve` | Approve confirmed order → processing + outbound |
| `POST /oms/orders/:id/reject` | Reject |
| `POST /oms/orders/:id/cancel` | Cancel |
| `GET /oms/orders/:id/timeline` | Events |
| `GET\|POST /oms/orders/export` | CSV |

Client: `GET|POST /api/client/oms/orders`, `POST /api/client/oms/orders/:id/confirm`.

---

## Module: Outbound (warehouse fulfillment)

### Frontend

| Path | Purpose |
|------|---------|
| `frontend/src/pages/OutboundListPage.tsx` | Outbound list **and Bulk Shipping entry point** (`/orders/outbound`) |
| `frontend/src/pages/OutboundDetailPage.tsx` | Workspace (pick/pack/shipping method/dispatch) |
| `frontend/src/pages/orders/OutboundCreatePage.tsx` | Create/edit |
| `frontend/src/components/outbound/OutboundOmsPanel.tsx` | Linked OMS panel on outbound detail |
| `frontend/src/components/shipping/*` | Shipping method / details / cartons |
| `frontend/src/api/outbound.ts` | API client |

### Backend

| Path | Purpose |
|------|---------|
| `backend/src/modules/outbound/outbound.controller.ts` | Routes |
| `backend/src/modules/outbound/outbound.service.ts` | Workflow |
| `backend/src/modules/outbound/outbound-admin-stages.ts` | Stage machine |
| `backend/src/modules/outbound/shipping-handoff-hook.service.ts` | After shipping-details → carrier |
| `backend/src/modules/oms/oms-outbound-sync.service.ts` | OMS creates this record |

### Database

`OutboundOrder` / `outbound_orders`, `OutboundOrderLine` / `outbound_order_lines`.

### Key APIs

`GET|POST /api/outbound-orders`, stage posts (`approve`, `complete-picking`, `complete-packing`, `select-shipping-method`, `shipping-details`, `complete-dispatch`, `cancel`), plus import/export.

---

## Module: Shipping & Bulk Shipping

**There is no `/shipping/bulk` page.** Bulk shipping is a modal on the outbound list.

### Frontend

| Path | Purpose |
|------|---------|
| `frontend/src/pages/OutboundListPage.tsx` | Opens bulk shipping |
| `frontend/src/components/shipping/BulkShippingProcessingModal.tsx` | Job UI |
| `frontend/src/pages/shipping/ShippingCompaniesPage.tsx` | Connect/test/disconnect providers (`/shipping/companies`) |
| `frontend/src/components/shipping/CarrierShippingDetailsForm.tsx` | Per-order carrier form |
| `frontend/src/api/shipping.ts` | `ShippingApi` including `bulkPreview`, `bulkConfirm`, `bulkGetJob`, `bulkRetryItem`, `bulkGetLabels` |

### Backend

| Path | Purpose |
|------|---------|
| `backend/src/modules/shipping/shipping.controller.ts` | All `/shipping` routes |
| `backend/src/modules/shipping/shipping.service.ts` | Connect, quote, create shipment, retry |
| `backend/src/modules/shipping/bulk-shipping.service.ts` | **Bulk label jobs** |
| `backend/src/modules/shipping/shipping-provider.interface.ts` | Provider contract |
| `backend/src/modules/shipping/shipping-provider.registry.ts` | Registered adapters (currently Babel only) |
| `backend/src/modules/shipping/shipping.constants.ts` | `BABEL_EXPRESS_CODE`, manual code |
| `backend/src/modules/shipping/providers/babel-express/babel-express.adapter.ts` | Babel implementation |
| `backend/src/modules/shipping/providers/babel-express/babel-express.http-client.ts` | HTTP to Babel |
| `backend/src/modules/shipping/providers/babel-express/babel-shipment.mapper.ts` | Payload mapping |
| `backend/src/modules/shipping/providers/babel-express/babel-geo-sync.service.ts` | Sync Babel cities/areas/neighbourhoods |
| `backend/src/modules/shipping/address-resolve.service.ts` | Pin / name → address |
| `backend/src/modules/shipping/shipping-config.util.ts` | Copy shipping fields OMS ↔ outbound |

### Database

| Model / table | Purpose |
|---------------|---------|
| `ShippingProvider` / `shipping_providers` | Catalog (`code` e.g. `BABEL_EXPRESS`) |
| `ShippingProviderConnection` / `shipping_provider_connections` | Encrypted credentials |
| `CarrierShipment` / `carrier_shipments` | Booked AWB + `shippingCost` |
| `BulkShippingJob` / `bulk_shipping_jobs` | Bulk job header |
| `BulkShippingJobItem` / `bulk_shipping_job_items` | Per-outbound result |
| `BabelCity` / `BabelArea` / `BabelNeighbourhood` | Cached Babel geo |

### Key APIs

| Endpoint | What it does |
|----------|----------------|
| `GET /shipping/providers` | List providers |
| `POST /shipping/providers/:code/connect` | Save credentials |
| `POST /shipping/rates` | Quote |
| `POST /shipping/shipments/:outboundOrderId/retry` | Retry carrier create |
| `GET /shipping/bulk/eligible` | Eligible outbounds |
| `POST /shipping/bulk/preview` | Preview quotes |
| `POST /shipping/bulk/jobs` | Start bulk job |
| `GET /shipping/bulk/jobs/:id` | Job status |
| `GET /shipping/bulk/jobs/:id/labels` | Labels |

Admin-only (`InternalAdminGuard`).

---

## Module: Billing

### Frontend (admin)

| Path | Purpose |
|------|---------|
| `frontend/src/pages/billing/BillingDashboardPage.tsx` | `/billing/dashboard` |
| `frontend/src/pages/billing/BillingPlansPage.tsx` | Plans list |
| `frontend/src/pages/billing/BillingPlanCreatePage.tsx` / `BillingPlanEditPage.tsx` / `BillingPlanDetailPage.tsx` | Plan CRUD |
| `frontend/src/pages/billing/BillingInvoicesPage.tsx` | Invoice list |
| `frontend/src/pages/billing/BillingInvoiceDetailPage.tsx` | Issue / lines / PDF |
| `frontend/src/components/billing/OrderManualChargesSection.tsx` | Ad-hoc order charges |
| `frontend/src/api/billing.ts` | API client |

### Frontend (client)

`client-frontend/src/pages/BillingPage.tsx`, `InvoicesPage.tsx`, `BillingInvoiceDetailPage.tsx` + `services/clientBillingService.ts`.

### Backend

| Path | Purpose |
|------|---------|
| `backend/src/modules/billing/billing.controller.ts` | Routes |
| **`billing-invoice-calculation.service.ts`** | **Charge engine** — change this to change how invoices are calculated |
| `billing-totals.util.ts` | Subtotal / discount / VAT / grand total |
| `billing-rate-snapshot.util.ts` | Freeze plan rates onto the cycle |
| `billing-plans.service.ts` | Plan CRUD |
| `billing-cycles.service.ts` | Cycle lifecycle |
| `billing-invoices.service.ts` | Invoice CRUD / issue |
| `billing-cycle-processor.service.ts` | Cron every 15 min — rollover + recalc |
| `order-manual-charges.service.ts` | Per-order extras |
| `billing-usage.service.ts` | Live CBM/weight (informational; not billed as system lines today) |

**What the engine actually bills today**

- `subscription` — `BillingPlan.fixedSubscriptionFee`
- `inbound` — inbound order count × `inboundOrderFee`
- `outbound` — outbound count using `outboundOrderFee` / `outboundBaseFee` + included items + additional item fee

Retired (deleted on recalc): `packaging`, `quality_check`, `excess_volume`, `excess_weight`.

### Database

`billing_plans`, `billing_cycles` (`rateSnapshot` JSON), `invoices`, `invoice_lines`, `order_manual_charges`.

### Key APIs

`GET|POST /api/billing/plans`, `GET /api/billing/cycles`, `GET|POST /api/billing/invoices`, `POST /api/billing/invoices/:id/issue`, `GET /api/billing/invoices/:id/pdf`, `GET /api/billing/preview`, `GET|POST /api/billing/order-charges`.

Client read-only: `GET /api/client/billing/invoices`, `/summary`, `/access`.

---

## Module: Inbound

| Layer | Path |
|-------|------|
| Admin list/detail | `frontend/src/pages/InboundListPage.tsx`, `InboundDetailPage.tsx` |
| Admin API | `frontend/src/api/inbound.ts` |
| Backend | `backend/src/modules/inbound/inbound.controller.ts`, `inbound.service.ts` |
| Client | `client-frontend/src/pages/InboundOrdersPage.tsx` + `services/clientInboundOrdersService.ts` |
| DB | `inbound_orders`, `inbound_order_lines` |
| APIs | `/api/inbound-orders`, `/api/client/inbound-orders` |

---

## Module: Inventory, products, locations, warehouses

| Concern | Frontend | Backend | DB |
|---------|----------|---------|-----|
| Stock | `pages/InventoryPage.tsx` | `modules/inventory/inventory.service.ts` | `current_stock` |
| Ledger | `pages/InventoryLedger*.tsx` | same | `inventory_ledger` |
| Products | `pages/ProductsPage.tsx` | `modules/products/` | `products`, `lots` |
| Locations | `pages/LocationsPage.tsx` | `modules/locations/` | `locations` |
| Warehouses | `pages/WarehousesPage.tsx` | `modules/warehouses/` | `warehouses` |
| Adjustments | `pages/AdjustmentsPage.tsx` | `modules/adjustments/` | `stock_adjustments` |
| Cycle count | `pages/cycle-count/` | `modules/cycle-count/` | `cycle_counts*` |

---

## Module: Warehouse workflow / tasks

| Path | Purpose |
|------|---------|
| `frontend/src/pages/TasksListPage.tsx` | Task queue |
| `frontend/src/pages/TaskExecutionView.tsx` | Execute pick/pack/receive/putaway/dispatch |
| `frontend/src/pages/tasks/*` | Per-task-type panels |
| `backend/src/modules/warehouse-workflow/warehouse-tasks.controller.ts` | `/api/tasks` |
| `backend/src/modules/warehouse-workflow/task-transitions.ts` | Task state machine |
| DB | `warehouse_tasks`, `task_assignments`, `task_events`, `workflow_instances` |

---

## Module: Client portal

Backend root: `backend/src/modules/client-portal/client-portal.module.ts`.

Subfolders: `auth/`, `oms/`, `inbound/`, `outbound/`, `products/`, `stock/`, `returns/`, `oms-returns/`, `billing/`, `dashboard/`, `notifications/`, `api-credentials/`, `order-import/`, `order-export/`, `shipping/`, `external-api/`.

All HTTP under `/api/client/...` with `JwtClientAuthGuard`.

---

## Module: External API

| Path | Purpose |
|------|---------|
| `backend/src/modules/client-portal/external-api/external-oms.controller.ts` | `/api/v1/oms` |
| `external-inbound.controller.ts` | `/api/v1/inbound` |
| `external-outbound.controller.ts` | `/api/v1/outbound` |
| `api-key.guard.ts` | `X-API-Key` + `X-API-Secret` |
| `canonical-api-docs.ts` | Docs served at `/api/client/apis/docs/:scope` |
| Client UI | `client-frontend/src/pages/ApisPage.tsx` |

Scopes: `oms`, `inbound`, `outbound` (`ApiCredential.scope`).

---

## Module: Reports

| Path | Purpose |
|------|---------|
| `frontend/src/pages/reports/*` | Report screens under `/reports/*` |
| `frontend/src/lib/reports/report-catalog.ts` | UI catalog |
| `frontend/src/api/reports.ts` | Client |
| `backend/src/modules/reports/reports.controller.ts` | `/api/reports/:reportId/{run,aggregate,kpis,export}` |
| `backend/src/modules/reports/framework/report-registry.config.ts` | **Register a new report ID here** |
| Runners | `oms-reports.runner.ts`, `finance-reports.runner.ts`, `operational-reports.runner.ts`, `inventory-intelligence-reports.runner.ts` |

Report IDs: `warehouse-analysis`, `inventory`, `product-moves`, `worker-productivity`, `order-cycle-time`, `inbound-accuracy`, `outbound-fill-rate`, `sla-compliance`, `stock-aging`, `lot-expiry`, `capacity-utilization`, `return-rate`, `revenue-by-client`, `receivables-aging`, `cod-report`, `merchant-orders`, `sales-report`, `returns-report`, `delivery-report`, `allocation-report`, `inventory-reserved`.

Roles allowed: `super_admin`, `wh_manager`, `finance`.

---

## Module: COD and OMS returns

| Concern | Frontend | Backend | DB |
|---------|----------|---------|-----|
| COD list/detail | `pages/OmsCodReturnsPages.tsx`, `OmsCodDetailPage.tsx` | `modules/cod/` | `cod_records`, `cod_adjustments` |
| Client “My profits” | `client-frontend/src/pages/CodReportsPage.tsx` | `GET /api/client/oms/cod-report` | same |
| OMS returns | `pages/OmsCodReturnsPages.tsx`, `OmsReturnDetailPage.tsx` | `modules/oms-returns/` | `oms_returns` |
| WMS returns | `pages/returns/` | `modules/returns/` | `return_orders` |

Admin COD/returns UI can be gated by build flag `OMS_COD_RETURNS_UI_ENABLED` in `frontend/vite.config.ts`.

---

# Cookbook — “where do I go if I want to…”

## Change the OMS Orders page

1. List UI: `frontend/src/pages/OmsOrdersListPage.tsx`
2. Filters / columns / export: same page + `frontend/src/components/oms/OmsOrdersExportModal.tsx`
3. Status labels: `frontend/src/lib/oms-commercial-status.ts`
4. API client: `frontend/src/api/oms.ts`
5. List query / filters: `backend/src/modules/oms/dto/list-oms-orders-query.dto.ts` + `oms-orders-list-where.ts`
6. Business rules: `backend/src/modules/oms/oms-orders.service.ts`

Client equivalent: `client-frontend/src/pages/EcommerceOrdersPage.tsx`.

## Change Bulk Shipping logic

1. UI: `frontend/src/components/shipping/BulkShippingProcessingModal.tsx` (opened from `OutboundListPage.tsx`)
2. API client: `frontend/src/api/shipping.ts` (`bulk*` methods)
3. **Job logic:** `backend/src/modules/shipping/bulk-shipping.service.ts`
4. Single-shipment create used by the job: `backend/src/modules/shipping/shipping.service.ts`
5. Tables: `bulk_shipping_jobs`, `bulk_shipping_job_items`, `carrier_shipments`

## How to add a shipping provider

1. Implement `ShippingProvider` in `backend/src/modules/shipping/providers/<name>/<name>.adapter.ts`.
2. Add a code constant in `shipping.constants.ts`.
3. Register the adapter in `shipping-provider.registry.ts` constructor (`this.byCode.set(...)`).
4. Add the adapter + HTTP client to `shipping.module.ts` `providers`.
5. Insert a row in `shipping_providers` (migration or seed) with a unique `code`.
6. If the carrier has its own geo, add sync/resolve helpers (see Babel under `providers/babel-express/`).
7. Admin UI cards: `frontend/src/pages/shipping/ShippingCompaniesPage.tsx` + `components/shipping/ShippingCarrierCards.tsx`.
8. Test via `POST /api/shipping/providers/:code/connect` and `/test`.

Manual shipping (`ShippingMethod.manual`) does **not** use an adapter.

## Change billing calculation

1. **Engine:** `backend/src/modules/billing/billing-invoice-calculation.service.ts`
2. Totals / VAT / discount: `billing-totals.util.ts`
3. Plan rates: `BillingPlan` in `schema.prisma` + `billing-plans.service.ts`
4. Cycle rollover: `billing-cycle-processor.service.ts`
5. Manual extras: `order-manual-charges.service.ts`
6. UI rates: `frontend/src/pages/billing/BillingPlanEditPage.tsx` and plan form components

## How to add an OMS order status

A status is not just an enum value. Update all of these:

1. `enum OmsOrderStatus` in `backend/prisma/schema.prisma` + a Prisma migration.
2. `oms-order-transitions.ts` — add to `OMS_PRIMARY_STATUSES` (and terminal/pre-fulfillment sets if needed) **and** add `ALLOWED` keys (`from|action|actor` → new status).
3. `oms-orders.service.ts` — the method that should write the new status.
4. `oms-order.mapper.ts` → `mapOutboundStatusToOms()` if warehouse sync should produce it.
5. Frontend unions/labels: `frontend/src/api/oms.ts`, `frontend/src/lib/oms-commercial-status.ts`, `OmsOrderTrackingPanel.tsx`, detail action flags in `OmsOrderDetailPage.tsx`.
6. Client labels: `client-frontend/src/lib/` status maps + ecommerce detail page.
7. Filters/export columns if the status should appear in lists.
8. Reports that filter by status (`oms-reports.runner.ts`).

If the status is a **warehouse** stage, change `OutboundOrderStatus` and `outbound-admin-stages.ts` instead (or in addition).

## Modify the database structure

See [Database, schema, migrations](#database-schema-migrations). After migrate: update Prisma-using services, DTOs, and UI types. Regenerating the client: `cd backend && npx prisma generate`.

## Change authentication or a permission

1. Backend guard/decorator on the controller method.
2. `rbac-policy.ts` if the capability is centralized.
3. `frontend/src/lib/rbac.ts` (nav + `canAccessPath`) so the page is not reachable.
4. Client: `client-frontend/src/lib/rbac.ts`.

## Change address validation on OMS create

- Admin form: `frontend/src/components/oms/OmsOrderFormModal.tsx`
- Client form: `client-frontend/src/pages/CreateEcommerceOrderPage.tsx`
- Server assert: `assertOmsCreateContactAndAddressRequired()` in `oms-orders.service.ts`
- Client DTO: `create-client-oms-order.dto.ts` (`@IsNotEmpty` on city/district/addressLine1)
- Admin DTO fields are `@IsOptional()` — **service layer is the real gate**

---

# Runtime notes (staging)

| Item | Value |
|------|-------|
| Backend process | `emdad-wms-backend-staging` |
| Port | `3001` |
| Redis | Typically off (`REDIS_ENABLED=false`) — single PM2 instance required for Socket.IO |
| Logs | `/var/log/emdad-wms-staging/` |
| Do not restart | Production process `emdad-wms-backend` |

---

# What this document is not

- Not a user manual (see `USER-MANUAL.md` / `FINAL-USER-MANUAL.md`).
- Not a data dictionary — use [DATA-ACCESS-AND-REPORTING.md](./DATA-ACCESS-AND-REPORTING.md).
- Root `README.md` still describes an early Phase 1 MVP. Prefer this file and the Prisma schema for what is actually running.
