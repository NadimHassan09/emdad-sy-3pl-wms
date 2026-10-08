# Data Access & Reporting Documentation

**Audience:** developers building reports, exports, analytics, or integrations.  
**Companion document:** [DEVELOPER-SYSTEM-ARCHITECTURE.md](./DEVELOPER-SYSTEM-ARCHITECTURE.md) — where to change code.

This describes **implemented** storage, tables, APIs, filters, and example queries. All HTTP paths are under the global prefix `/api`.

---

## How to use this document

| Question | Jump to |
|----------|---------|
| All orders in a month | [Orders](#orders-oms--outbound) |
| Shipments by carrier | [Shipments and carriers](#shipments-and-carriers) |
| Shipping charges for a period | [Shipping costs](#shipping-costs) |
| Billing / invoices | [Billing and invoices](#billing-and-invoices) |
| Status history | [Order status history](#order-status-history) |
| Built-in report IDs | [Reports framework](#reports-framework) |
| Auth for APIs | [Authentication for data access](#authentication-for-data-access) |
| Which fields to chart | [Recommended report fields](#recommended-report-fields) |

---

## 1. Where the data lives

| Store | What it holds | How it is configured |
|-------|---------------|----------------------|
| **PostgreSQL** | All transactional data (orders, stock, billing, shipping, users) | `DATABASE_URL` in `backend/.env` |
| **Prisma schema** | Models / enums / table names | `backend/prisma/schema.prisma` |
| **Redis** (optional) | Report cache (~60s), Socket.IO adapter | `REDIS_ENABLED`, `REDIS_HOST`, `REDIS_PORT` — often **off** on staging |
| **Filesystem** | Invoice/GRN/DN PDFs, product images, backup files | `DOCUMENT_STORAGE_DIR`, `MEDIA_STORAGE_DIR`, `BACKUP_STORAGE_PATH` |

There is no separate analytics warehouse. Reports run against the same PostgreSQL database.

**Prisma Studio (staging):** from `backend/`, `npm run db:studio` uses the same `DATABASE_URL`.

---

## 2. Tenant model (read this first)

Almost every business row has `company_id` → `companies.id`.

- A **company** is a 3PL client (merchant), not an end-customer.
- End-customers (recipients) live **on the order**: `recipient_name`, `recipient_phone`, `city`, `district`, `address_line1`. There is no `customers` table.
- Admin APIs can see many companies; pass `companyId` or header `X-Company-Id`.
- Client JWT and API keys are **hard-locked** to one `companyId`.

```
Company (client / merchant)
 ├── users (client_admin / client_staff)
 ├── products → lots → current_stock
 ├── inbound_orders → inbound_order_lines
 ├── outbound_orders → outbound_order_lines
 │    ├── oms_orders?          (1:1 via oms_orders.outbound_order_id)
 │    ├── carrier_shipments[]
 │    └── stock_reservations[]
 ├── oms_orders → oms_order_lines
 │    ├── oms_order_events[]
 │    └── cod_records?         (1:1)
 ├── billing_plans → billing_cycles → invoices → invoice_lines
 └── api_credentials
```

**OMS vs outbound:** `oms_orders` is the commercial order. `outbound_orders` is warehouse fulfillment. Link: `oms_orders.outbound_order_id`. Many admin “OMS” reports actually query `outbound_orders` once fulfillment has started.

---

## 3. Authentication for data access

| Surface | How to authenticate | Tenant scope |
|---------|---------------------|--------------|
| Admin / warehouse API | Internal JWT (`Authorization: Bearer` or cookie `access_token`) | Optional `X-Company-Id` or `companyId` |
| Client portal API | Client JWT (`/api/client/...`) | Always the user’s company |
| External REST | `X-API-Key` + `X-API-Secret` (or `Authorization: Bearer key:secret`) | Credential’s company + scope (`oms` / `inbound` / `outbound`) |
| Reports | Internal JWT; role must be `super_admin`, `wh_manager`, or `finance` | Same as admin |
| Shipping admin | Internal JWT + internal-admin (`super_admin` / `wh_manager`) | Admin-only credentials |

Client tokens are rejected by the admin JWT strategy and vice versa.

**Pagination (almost all list endpoints):** `limit` default **50**, max **500**; `offset` default **0**.

**Date query params:** `YYYY-MM-DD` (UTC day boundaries in report runners).

---

## 4. Important tables and fields

Column names below are **PostgreSQL** (`snake_case`). Prisma uses camelCase (`orderNumber` ↔ `order_number`).

### 4.1 `companies` — clients / merchants

| Field | Use for |
|-------|---------|
| `id` | Join key |
| `name`, `trade_name` | Display |
| `status` | `active`, `paused`, `restricted`, `suspended`, `archived`, … |
| `billing_cycle` | `monthly` / `quarterly` |
| `payment_terms_days` | AR due-date logic |
| `contact_email`, `contact_phone` | Contact |

**Access:** `GET /api/companies`, `GET /api/companies/:id` (admin JWT).

### 4.2 `oms_orders` — commercial orders

| Field | Use for |
|-------|---------|
| `id`, `order_number` | Identity (`OMS-…`, set by DB trigger) |
| `company_id` | Client |
| `outbound_order_id` | Linked warehouse order (null until provisioned) |
| `status` | Commercial status (see below) |
| `recipient_name`, `recipient_phone` | End customer |
| `city`, `district`, `address_line1`, `address_line2`, `destination_address` | Address |
| `payment_method` | `COD`, `prepaid`, … |
| `subtotal`, `shipping_fee`, `cod_amount`, `currency` | Money |
| `cod_status`, `cod_collected_at`, `cod_remitted_at` | COD lifecycle on the order |
| `allocation_status` | `none` / `allocated` / `released` / `fulfilled` |
| `store_channel`, `external_reference`, `client_reference` | Channel / merchant refs |
| `shipping_provider_code`, `carrier`, `tracking_number` | Shipping snapshot |
| `needs_information` | Incomplete import flag |
| `created_at`, `confirmed_at`, `approved_at`, `delivered_at`, `cancelled_at` | Time series |

**Primary statuses written today:**  
`waiting_for_confirmation` → `confirmed_waiting_for_admin_approval` → `processing` → `ready_to_ship` → `shipped` → `delivered`  
Also: `cancelled`, `failed_delivery`, `returned`. Legacy values still exist on old rows (`draft`, `pending`, `approved`, …).

**Access**

- Admin: `GET /api/oms/orders?createdFrom=2026-09-01&createdTo=2026-09-30&companyId=<uuid>&status=delivered`
- Client: `GET /api/client/oms/orders?createdFrom=…&createdTo=…`
- External: `GET /api/v1/oms/orders` (scope `oms`)
- Export: `GET|POST /api/oms/orders/export` (max 10,000 rows)

### 4.3 `oms_order_lines`

`oms_order_id`, `product_id`, `requested_quantity`, `unit_price`, `line_total`, `discount_amount`, `line_number`.

### 4.4 `outbound_orders` — warehouse shipments / fulfillment

Mirrors most OMS commercial fields **plus** warehouse timestamps and shipping-method fields.

| Extra field | Use for |
|-------------|---------|
| `status` | Warehouse stage (`draft` … `waiting_for_shipping_method` … `shipped` / `delivered`) |
| `shipped_at`, `picking_started_at`, `out_for_delivery_at` | Ops cycle time |
| `shipping_method` | `manual` or carrier |
| `shipping_provider_code` | Carrier used |
| `shipping_packages` | JSON carton layout |
| `babel_neighbourhood_id` | Babel geo id |

**Access:** `GET /api/outbound-orders?createdFrom=&createdTo=&companyId=&status=`  
Export: `GET|POST /api/outbound-orders/export`.

### 4.5 `oms_order_events` — status history

| Field | Meaning |
|-------|---------|
| `oms_order_id` / `outbound_order_id` | Parent |
| `event_type` | e.g. `order.waiting_for_confirmation`, `oms.approved`, `oms.delivered` |
| `payload` | JSON details |
| `created_at`, `created_by` | When / who |

**Access:** `GET /api/oms/orders/:id/timeline` or `GET /api/client/oms/orders/:id/timeline`.  
There is no “list all events across companies” HTTP endpoint — use SQL/Prisma for that.

### 4.6 Shipping tables

**`shipping_providers`** — catalog (`code`, `name`, `enabled`).  
**`shipping_provider_connections`** — encrypted credentials (do not export secrets).  
**`carrier_shipments`** — actual bookings:

| Field | Use for |
|-------|---------|
| `outbound_order_id` | Join to shipment/order |
| `provider_code` | Carrier (`BABEL_EXPRESS`) |
| `external_awb`, `tracking_number` | Tracking |
| `status` | `pending` / created / failed (see `CarrierShipmentStatus`) |
| `shipping_cost`, `currency` | **Actual carrier cost** |
| `created_at` | When booked |

**`bulk_shipping_jobs` / `bulk_shipping_job_items`** — batch label runs (`quoted_price`, `selected_provider_code`, `estimated_total_cost`).

**Access:** admin `GET /api/shipping/providers`; shipment rows are not listed as a standalone public report — query `carrier_shipments` or join from outbound detail. Bulk: `GET /api/shipping/bulk/jobs/:id`.

### 4.7 Billing tables

**`billing_plans`** — rate card: `fixed_subscription_fee`, `inbound_order_fee`, `outbound_order_fee`, `outbound_base_fee`, `outbound_included_items`, `outbound_additional_item_fee`.

**`billing_cycles`** — `starts_at`, `ends_at`, `status` (`active` / `expired` / `renewed`), `rate_snapshot` (JSON freeze of rates).

**`invoices`**

| Field | Use for |
|-------|---------|
| `invoice_number` | Human id |
| `status` | `draft`, `unpaid`, `paid`, `cancelled` |
| `invoice_source` | `cycle` or `ad_hoc` |
| `subtotal_amount`, `discount_amount`, `vat_amount`, `grand_total`, `total_amount` | Money |
| `issued_at`, `due_date` | AR |
| `billing_cycle_id` | Period |

**`invoice_lines`:** `type` (`subscription`, `inbound`, `outbound`, `manual`, `order_charge`, plus retired types), `line_source` (`system` / `manual` / `order`), `quantity`, `unit_price`, `total_price`.

**`order_manual_charges`:** extras attached by `reference_type` + `reference_id`.

**Access**

- Admin: `GET /api/billing/invoices?companyId=&status=&createdFrom=&createdTo=`
- Detail / PDF: `GET /api/billing/invoices/:id`, `GET /api/billing/invoices/:id/pdf`
- Client: `GET /api/client/billing/invoices`

### 4.8 COD

Prefer **`cod_records`** (1:1 with `oms_orders`) + `cod_adjustments` for a ledger.  
Order-level snapshots also exist on `oms_orders` / `outbound_orders` (`cod_amount`, `cod_status`).

Admin: `GET /api/cod/records`, `GET /api/cod/by-order/:omsOrderId`.  
Client: `GET /api/client/oms/cod-report?dateFrom=&dateTo=&codStatus=`.

### 4.9 Inventory (for ops / reserved-stock reports)

| Table | Use |
|-------|-----|
| `products` | SKU, name, `weight_kg`, `volume_cbm` |
| `current_stock` | `quantity_on_hand`, `quantity_reserved`, `quantity_available` |
| `inventory_ledger` | All movements (`movement_type`, `reference_type`, `reference_id`, `created_at`) — month-partitioned |
| `stock_reservations` | Allocation holds for outbound lines |

`GET /api/inventory/stock`, `GET /api/inventory/ledger`. Client: `GET /api/client/stock`.

### 4.10 Users (not “customers”)

`users.role`: `super_admin`, `wh_manager`, `wh_operator`, `finance`, `client_admin`, `client_staff`.  
Client users have `company_id`. Internal users may have rows in `user_company_access`.

---

## 5. Orders

### Data source

- Commercial: `oms_orders` + `oms_order_lines`
- Fulfillment: `outbound_orders` + `outbound_order_lines`
- History: `oms_order_events`

### Purpose

Merchant sales orders (OMS) and warehouse pick/pack/ship orders (outbound).

### Relationships

`oms_orders.company_id` → `companies`  
`oms_orders.outbound_order_id` → `outbound_orders`  
`oms_order_lines.product_id` → `products`  
`oms_orders.id` → `oms_order_events.oms_order_id`, `cod_records.oms_order_id`

### Access

```http
GET /api/oms/orders?companyId=<uuid>&createdFrom=2026-09-01&createdTo=2026-09-30&limit=100&offset=0
Authorization: Bearer <internal-jwt>
```

Useful filters: `status`, `orderSearch`, `customer`, `phone`, `city`, `storeChannel`, `linkStatus=linked|unlinked`, `totalOp` + `totalValue`.

```http
GET /api/client/oms/orders?createdFrom=2026-09-01&createdTo=2026-09-30
Cookie: client_access_token=...
```

```http
GET /api/v1/oms/orders?createdFrom=2026-09-01&createdTo=2026-09-30
X-API-Key: ...
X-API-Secret: ...
```

Single external lookup: `GET /api/v1/oms/orders?orderNumber=OMS-…` or `?externalOrderId=…`.

### Example — all OMS orders in a month

```sql
SELECT
  o.order_number,
  c.name AS client,
  o.status,
  o.recipient_name,
  o.city,
  o.district,
  o.address_line1,
  o.payment_method,
  o.subtotal,
  o.shipping_fee,
  o.cod_amount,
  o.created_at,
  o.delivered_at,
  oo.order_number AS outbound_number,
  oo.status AS warehouse_status
FROM oms_orders o
JOIN companies c ON c.id = o.company_id
LEFT JOIN outbound_orders oo ON oo.id = o.outbound_order_id
WHERE o.created_at >= '2026-09-01'
  AND o.created_at <  '2026-10-01'
ORDER BY o.created_at DESC;
```

```ts
await prisma.omsOrder.findMany({
  where: {
    companyId: clientId, // omit for all tenants (admin / SQL only)
    createdAt: {
      gte: new Date('2026-09-01T00:00:00.000Z'),
      lt: new Date('2026-10-01T00:00:00.000Z'),
    },
  },
  include: { lines: true, outboundOrder: true, company: true },
  orderBy: { createdAt: 'desc' },
});
```

CSV: `GET /api/oms/orders/export?createdFrom=2026-09-01&createdTo=2026-09-30` or the admin UI export modal.

---

## 6. Customers / clients

### Data source

`companies` = 3PL clients.  
Recipients = columns on `oms_orders` / `outbound_orders` (no customer master).

### Access

```http
GET /api/companies?search=&status=active&limit=50
```

Distinct recipients for a month (analysis, not an API):

```sql
SELECT DISTINCT recipient_name, recipient_phone, city, district
FROM oms_orders
WHERE company_id = '<uuid>'
  AND created_at >= '2026-09-01'
  AND created_at <  '2026-10-01'
  AND recipient_phone IS NOT NULL;
```

---

## 7. Shipments and carriers

### Data source

| Source | Contains |
|--------|----------|
| `carrier_shipments` | Booked AWB, tracking, **carrier cost** |
| `outbound_orders` | `carrier`, `tracking_number`, `shipping_provider_code`, `shipped_at` |
| `shipping_providers` | Provider catalog |
| `bulk_shipping_job_items` | Quoted price at bulk-ship time |

### Access

```http
GET /api/shipping/providers
```

There is no `GET /shipping/shipments` list. Use SQL or outbound export + join.

### Example — shipments by provider for a month

```sql
SELECT
  cs.provider_code,
  cs.status,
  COUNT(*) AS shipment_count,
  SUM(cs.shipping_cost) AS total_carrier_cost,
  cs.currency
FROM carrier_shipments cs
JOIN outbound_orders oo ON oo.id = cs.outbound_order_id
WHERE cs.created_at >= '2026-09-01'
  AND cs.created_at <  '2026-10-01'
  AND oo.company_id = '<uuid>'          -- optional
GROUP BY cs.provider_code, cs.status, cs.currency
ORDER BY shipment_count DESC;
```

Filter one provider:

```sql
SELECT
  oo.order_number,
  oo.company_id,
  cs.external_awb,
  cs.tracking_number,
  cs.shipping_cost,
  cs.currency,
  cs.created_at
FROM carrier_shipments cs
JOIN outbound_orders oo ON oo.id = cs.outbound_order_id
WHERE cs.provider_code = 'BABEL_EXPRESS'
  AND cs.created_at >= '2026-09-01'
  AND cs.created_at <  '2026-10-01';
```

Currently the only registered adapter is **`BABEL_EXPRESS`**. Manual shipping has no `carrier_shipments` row.

---

## 8. Shipping costs

Three different numbers — do not mix them:

| Amount | Table / field | Meaning |
|--------|---------------|---------|
| Commercial shipping fee | `oms_orders.shipping_fee` / `outbound_orders.shipping_fee` | Charged to the end customer |
| Carrier cost | `carrier_shipments.shipping_cost` | What Babel (etc.) charged EMDAD |
| Quote at bulk time | `bulk_shipping_job_items.quoted_price` | Estimate, not necessarily billed |
| 3PL outbound fee | `invoice_lines` where `type = 'outbound'` | What EMDAD billed the merchant |

### Example — carrier charges for a period

```sql
SELECT
  DATE_TRUNC('day', cs.created_at) AS day,
  cs.provider_code,
  SUM(cs.shipping_cost) AS carrier_cost,
  cs.currency
FROM carrier_shipments cs
WHERE cs.created_at >= '2026-09-01'
  AND cs.created_at <  '2026-10-01'
  AND cs.shipping_cost IS NOT NULL
GROUP BY 1, 2, 4
ORDER BY 1;
```

### Example — 3PL shipping-related invoice lines

```sql
SELECT i.invoice_number, i.issued_at, il.type, il.quantity, il.unit_price, il.total_price
FROM invoice_lines il
JOIN invoices i ON i.id = il.invoice_id
WHERE i.issued_at >= '2026-09-01'
  AND i.issued_at <  '2026-10-01'
  AND il.type IN ('outbound', 'order_charge')
  AND i.status IN ('unpaid', 'paid');
```

---

## 9. Billing and invoices

### Data source

`billing_plans` → `billing_cycles` → `invoices` → `invoice_lines`  
plus `order_manual_charges`.

### Access

```http
GET /api/billing/invoices?companyId=<uuid>&status=unpaid&createdFrom=2026-09-01&createdTo=2026-09-30
GET /api/billing/invoices/<invoiceId>
GET /api/billing/invoices/<invoiceId>/pdf
GET /api/billing/cycles?companyId=<uuid>
GET /api/billing/plans
GET /api/client/billing/invoices
```

Finance reports: `GET /api/reports/revenue-by-client/run`, `GET /api/reports/receivables-aging/run`.

### Example

```sql
SELECT
  i.invoice_number,
  c.name AS client,
  i.status,
  i.invoice_source,
  i.subtotal_amount,
  i.discount_amount,
  i.vat_amount,
  i.grand_total,
  i.issued_at,
  i.due_date,
  bc.starts_at AS cycle_start,
  bc.ends_at AS cycle_end
FROM invoices i
JOIN companies c ON c.id = i.company_id
LEFT JOIN billing_cycles bc ON bc.id = i.billing_cycle_id
WHERE i.issued_at >= '2026-09-01'
  AND i.issued_at <  '2026-10-01'
  AND i.status IN ('unpaid', 'paid')
ORDER BY i.issued_at;
```

```ts
await prisma.invoice.findMany({
  where: {
    issuedAt: { gte: new Date('2026-09-01'), lt: new Date('2026-10-01') },
    status: { in: ['unpaid', 'paid'] },
  },
  include: {
    lines: true,
    company: { select: { name: true } },
    billingCycle: { select: { startsAt: true, endsAt: true } },
  },
});
```

**How cycle invoices are calculated (for interpreting lines):**  
system lines = subscription + inbound count × inbound fee + outbound count × outbound fees.  
See `backend/src/modules/billing/billing-invoice-calculation.service.ts`. Storage CBM is **not** a billed system line today.

---

## 10. Order status history

### Data source

`oms_order_events`

### Access

```http
GET /api/oms/orders/<omsOrderId>/timeline
```

```sql
SELECT event_type, payload, created_at, created_by
FROM oms_order_events
WHERE oms_order_id = '<uuid>'
ORDER BY created_at ASC;
```

```ts
await prisma.omsOrderEvent.findMany({
  where: { omsOrderId },
  orderBy: { createdAt: 'asc' },
  select: {
    eventType: true,
    payload: true,
    createdAt: true,
    creator: { select: { fullName: true, email: true } },
  },
});
```

Warehouse task history (pick/pack/dispatch) is `task_events` / `warehouse_tasks`, not OMS events.

---

## 11. Reports framework (built-in dashboards)

Use this when you want an already-aggregated dataset rather than raw SQL.

```http
GET /api/reports/<reportId>/run?dateFrom=2026-09-01&dateTo=2026-09-30&companyId=<uuid>&limit=100
GET /api/reports/<reportId>/aggregate?groupBy=status
GET /api/reports/<reportId>/export?format=csv&dateFrom=2026-09-01&dateTo=2026-09-30
```

Optional: `warehouseId`, `status`, `sku`. Warehouse-required reports need `warehouseId`.

| reportId | What it answers | Runner file |
|----------|-----------------|-------------|
| `merchant-orders` | OMS/outbound order volume by client | `oms-reports.runner.ts` |
| `sales-report` | Sales amounts | same |
| `delivery-report` | Delivery outcomes | same |
| `allocation-report` | Allocation state | same |
| `inventory-reserved` | Reserved stock | same |
| `cod-report` | COD | same |
| `returns-report` | Returns | same |
| `revenue-by-client` | Billed revenue | `finance-reports.runner.ts` |
| `receivables-aging` | Unpaid invoices by age | same |
| `warehouse-analysis` | Weekly inbound/outbound counts | `operational-reports.runner.ts` |
| `order-cycle-time` | Hours to complete | same |
| `outbound-fill-rate` | Picked vs requested | same |
| `inbound-accuracy` | Receive vs expected | same |
| `worker-productivity` | Task completions | same |
| `sla-compliance` | SLA | same |
| `inventory` | On-hand / reserved | inventory runner |
| `product-moves` | Ledger movements | same |
| `stock-aging`, `lot-expiry`, `capacity-utilization`, `return-rate` | Inventory intelligence | `inventory-intelligence-reports.runner.ts` |

Admin UI: `/reports/<reportId>` (`frontend/src/pages/reports/*`).

### Limits

| Area | Cap |
|------|-----|
| List APIs | `limit` max 500 |
| Report preview | `limit` max 200, `offset` max 10,000 |
| Report / order CSV export | **10,000 rows**; headers `X-Export-Row-Count`, `X-Export-Truncated` |
| Report aggregate | 500 grouped rows |
| Report cache | 60 seconds when Redis is on |
| OMS report runner | Internal sample cap 2,000 before in-memory page |
| Throttle | Reports ~5/min; order exports ~10/min |

---

## 12. Building a reporting dashboard — which API?

| Dashboard | Call |
|-----------|------|
| Admin ops overview | `GET /api/dashboard/overview` |
| Open-order charts | `GET /api/dashboard/open-orders-charts` |
| OMS KPIs | `GET /api/oms/dashboard`, `GET /api/oms/dashboard/order-summary` |
| Billing KPIs | `GET /api/billing/dashboard/summary` |
| Task analytics | `GET /api/analytics/overview?warehouse_id=&days=` |
| Any of the 20 reports | `GET /api/reports/:reportId/run` + `/aggregate` + `/kpis` |
| Client portal home | `GET /api/client/dashboard/overview` |
| Raw extract for BI | CSV exports on OMS / inbound / outbound, or SQL on PostgreSQL |

For a **new** BI tool, prefer:

1. Scheduled SQL against PostgreSQL (full history, no 10k cap), or  
2. `GET /api/reports/:id/export?format=csv|xls` for approved slices, or  
3. External API lists if the consumer is a merchant (scoped to one company).

---

## 13. Recommended report fields

| Domain | Use these |
|--------|-----------|
| Commercial orders | `oms_orders.order_number`, `status`, `recipient_name`, `city`, `payment_method`, `subtotal`, `shipping_fee`, `cod_amount`, `store_channel`, `external_reference`, `created_at`, `delivered_at` |
| Fulfillment | `outbound_orders.status`, `shipped_at`, `allocation_status`, line `requested_quantity` / `picked_quantity` |
| Delivery / carrier | `carrier_shipments.provider_code`, `external_awb`, `tracking_number`, `shipping_cost`; order `delivered_at` |
| COD | `cod_records.original_amount`, `status`, `available_at`, `paid_out_at` **or** order `cod_amount` / `cod_status` |
| Billing / AR | `invoices.invoice_number`, `status`, `issued_at`, `due_date`, `grand_total`; lines `type`, `quantity`, `unit_price`, `total_price` |
| Inventory | `current_stock.quantity_on_hand`, `quantity_reserved`, `quantity_available`; ledger `movement_type`, `quantity`, `created_at` |
| Client dimension | `companies.name`, `status`, `billing_cycle` |
| Worker / SLA | SQL view `v_analytics_wh_task_completed_rows` (`task_type`, `duration_minutes`, `completed_at`) |

**Do not** use `address_line1 = 'none'` as “missing address” unless you also treat other placeholders. Empty UI fallback is `—`; the literal string `none` can be stored user input.

---

## 14. Export and integration catalog

| Endpoint | Format | Auth |
|----------|--------|------|
| `GET\|POST /api/oms/orders/export` | CSV | Admin JWT |
| `GET\|POST /api/inbound-orders/export` | CSV | Admin JWT |
| `GET\|POST /api/outbound-orders/export` | CSV | Admin JWT |
| `POST /api/client/oms/orders/export` | CSV | Client JWT |
| `POST /api/client/inbound-orders/export` | CSV | Client JWT |
| `POST /api/client/outbound-orders/export` | CSV | Client JWT |
| `GET /api/reports/:reportId/export` | CSV or XLS | Admin + finance roles |
| `GET /api/audit-logs/export` | CSV or JSON | Admin (date range required) |
| `GET /api/client/oms/cod-report` | JSON | Client JWT |
| `GET /api/billing/invoices/:id/pdf` | PDF | Admin |
| `GET /api/v1/oms/orders` | JSON | API key, scope `oms` |
| `GET /api/v1/outbound/orders` | JSON | API key, scope `outbound` |
| `GET /api/v1/inbound/orders` | JSON | API key, scope `inbound` |

Column catalogs: `GET /api/*/export/columns` where implemented (OMS, inbound, outbound).

---

## 15. Worked answers

### How can I get all orders during a specific month?

Admin API: `GET /api/oms/orders?createdFrom=2026-09-01&createdTo=2026-09-30&limit=500` and page with `offset`.  
Or SQL on `oms_orders.created_at` (section 5).  
CSV: `/api/oms/orders/export` with the same dates (max 10k).

Use `delivered_at` instead of `created_at` if you want **delivered in that month**.

### How can I get all shipments handled by a specific shipping provider?

SQL on `carrier_shipments.provider_code` joined to `outbound_orders` (section 7).  
Provider list: `GET /api/shipping/providers`.

### How can I calculate shipping charges for a period?

Decide which charge:

- Carrier cost → `SUM(carrier_shipments.shipping_cost)`  
- Customer shipping fee → `SUM(oms_orders.shipping_fee)` or outbound  
- Merchant 3PL fee → `invoice_lines` with `type = 'outbound'`

### How can I get billing / invoice data?

`GET /api/billing/invoices` + `/:id`, or SQL on `invoices` / `invoice_lines` (section 9).  
Aging: `GET /api/reports/receivables-aging/run`.

### Which tables contain what I need?

See sections 4–10. Start with `oms_orders`, `outbound_orders`, `carrier_shipments`, `invoices`, `companies`.

### Which API should I call for a reporting dashboard?

`/api/reports/:reportId/run` for a known report; `/api/dashboard/overview` + `/api/oms/dashboard` for home KPIs; SQL or CSV for a custom BI warehouse.

### How can I export data for analysis?

1. Admin/client CSV export endpoints (10k cap).  
2. `GET /api/reports/:id/export?format=xls`.  
3. Direct PostgreSQL (no row cap; respect tenant filters).  
4. Merchant-scoped JSON via `/api/v1/...` if they hold an API key.

---

## 16. Limitations and pitfalls

- **No customer table.** Recipients are denormalized on orders.
- **OMS vs outbound duplication.** After approve, shipping/COD fields exist on both; prefer outbound for warehouse facts and OMS for pre-fulfillment.
- **Delivered is admin-confirmed** on OMS; warehouse `delivered` does not auto-write OMS `delivered`.
- **Prisma is the Phase-1+ model set.** Some SQL objects (analytics views, audit-log storage) exist in Postgres but are not all first-class Prisma models.
- **Do not read production for writes.** Staging DB only unless you have an explicit read-only production request.
- **Secrets:** never export `shipping_provider_connections` credentials or `api_credentials.secret_hash` into reports.

---

## 17. Key file paths

| Item | Path |
|------|------|
| Schema | `backend/prisma/schema.prisma` |
| Migrations | `backend/prisma/migrations/` |
| OMS list filters | `backend/src/modules/oms/dto/list-oms-orders-query.dto.ts` |
| Report registry | `backend/src/modules/reports/framework/report-registry.config.ts` |
| Billing engine | `backend/src/modules/billing/billing-invoice-calculation.service.ts` |
| External OMS API | `backend/src/modules/client-portal/external-api/external-oms.controller.ts` |
| Env names | `backend/src/common/config/env.validation.ts` |
