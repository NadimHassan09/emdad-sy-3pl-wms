# EMDAD WMS/OMS — Historical Development Audit & Technical Handover Report
**Audit Period:** September 1, 2026 – November 2, 2026  
**Auditor:** Senior Software Engineer & Technical Auditor (Antigravity Agent)  
**Target Environment:** EMDAD 3PL Staging Environment (`/var/www/emdad-sy-3pl-wms-staging`)  
**Target Recipient:** AI Engineering Agent (Claude) & Engineering Leadership  
**Classification:** STRICTLY TECHNICAL & FACTUAL — RESEARCH & HANDOVER ONLY (NO PRODUCTION MODIFICATIONS)

---

## 1. Executive Summary

### 1.1 Context and Purpose
Between **September 1, 2026** and **November 2, 2026**, the EMDAD 3PL Warehouse Management System (WMS) and Order Management System (OMS) underwent extensive architectural and functional expansion. The platform transitioned from a warehouse-centric fulfillment system into an integrated 3PL logistics gateway, connecting multi-channel client orders to regional Syrian courier carriers (**Babel Express**, **Sila SY**, and **Sena Express**) while replacing legacy subscription-based billing with an append-only double-entry **Client Financial Account** and cash-on-delivery (COD) ledger.

This technical handover report serves as an exhaustive, verifiable audit of all changes made during this two-month window. It provides the incoming AI engineering agent (Claude) and the engineering team with exact source paths, commit hashes, database schema evolutions, carrier integration realities, and operational constraints without requiring reinvention or repeated codebase exploration.

### 1.2 Core Audit Findings

1. **Architecture & Deployment Realities:**
   - **Staging Runtime:** Staging backend runs via PM2 process `emdad-wms-backend-staging` (ID: 1, Node.js v22.22.2) on `127.0.0.1:3001` mapped via Nginx to `staging-api.emdadsy.com`. Production runs on port 3000 (`emdad-wms-backend`, ID: 0).
   - **Frontend UI Switch:** A major redesign effort (`web-v2`) was initiated in early October 2026 but abandoned/deactivated on staging. Nginx upstream routing (`/etc/nginx/conf.d/02-emdad-ui-switch.conf`) explicitly routes traffic to the classic production-aligned Single Page Applications (SPAs):
     - Admin Portal: `/var/www/emdad-sy-3pl-wms-staging/frontend/dist` (`staging-admin.emdadsy.com`)
     - Client Portal: `/var/www/emdad-sy-3pl-wms-staging/client-frontend/dist` (`staging-client.emdadsy.com`)
   - **Database State:** PostgreSQL database `wms_db_staging` (on localhost:5432) has all **100 Prisma migrations** applied and is fully up-to-date with schema version `20261228120000_financial_management_mvp`.

2. **Carrier Integrations vs. Commercial Realities:**
   - **Babel Express:** Supports shipment creation, tracking queries, and rate quotes. It **does not support cancellation via API** (returns `refused: cancel_unsupported`) and has **no shipment modification/editing endpoint**. Waybills are split into master/part barcodes, requiring distinct rendering logic.
   - **Sila SY:** A multi-courier aggregator supporting create, track, HMAC-SHA256 authenticated webhooks, and `PUT /cargos/{id}/cancel`. However, cancellation frequently enters a `courier_cancel: 'pending_confirmation'` state where final cancellation requires external courier confirmation. Sila does **not** provide an order-updating endpoint.
   - **Sena Express:** Full create, track, and webhook support. API shipment cancellation is **refused**. No update endpoint exists.
   - **Operational Impact:** Requests to "edit carrier or order info on Ready for Shipping" cannot be transmitted directly as updates to carriers. They require local superseding/cancellation and complete re-creation.

3. **Financial Cutover vs. Legacy Billing:**
   - The platform operates in a **dual-stack state**. The legacy subscription system (`BillingPlan`, `BillingCycle`, volume capacity gating) remains in the codebase and navigation.
   - The new **Finance System** (`ClientFinancialAccount`, `FinancialTransaction`, `ClientPayoutRequest`) is active (`cutover_active: true`). Operational access gates in [billing-access.service.ts](file:///var/www/emdad-sy-3pl-wms-staging/backend/src/modules/billing/billing-access.service.ts#L175-L187) now permit client order creation if the client has an active financial account, effectively decoupling order entry from legacy billing cycles.

4. **Code Quality and Uncommitted State:**
   - Staging contains **484 modified files** in its uncommitted working tree relative to Git commit `04470a92` (representing 78,069 insertions and 18,467 deletions). This uncommitted code houses the late-October features: multi-page `StatusCardNav`, streaming ExcelJS exports, return-to-warehouse inventory restocking, and financial statement generation.

---

## 2. Original Application Architecture (Pre-September 1, 2026)

Before September 1, 2026, the application operated as a warehouse-focused 3PL platform with basic courier capabilities.

### 2.1 Backend Architecture
- **Framework:** NestJS (v10.x) with TypeScript.
- **ORM / Database:** Prisma ORM connected to PostgreSQL 15+.
- **Authentication:** JWT with Bearer tokens; RBAC with user roles `ADMIN`, `SUPER_ADMIN`, and `CLIENT`.
- **Core Modules:**
  - `AuthModule`: Identity and session issuance.
  - `UsersModule`: Tenant and staff account management.
  - `ProductsModule`: SKU registry and barcode handling.
  - `WarehouseModule` & `LocationsModule`: Physical warehouse topology (Zones, Aisles, Racks, Shelves, Bins).
  - `InventoryModule`: Stock tracking at specific bin locations with `InventoryMovement` logging.
  - `OrdersModule`: WMS Inbound (receiving, putaway) and Outbound (picking, packing, shipping).
  - `OmsOrdersModule`: Early stage order intake for clients, loosely coupled to warehouse outbound orders.
  - `Legacy BillingModule`: Monthly billing cycles, storage fees calculated from occupied warehouse capacity, and static per-order fulfillment fees.

### 2.2 Frontend Applications
1. **Admin Portal (`frontend/`):** React 18, Vite, TailwindCSS, React Query (@tanstack/react-query), React Hook Form, Lucide React icons. Served via Nginx to warehouse staff and administrators.
2. **Client Portal (`client-frontend/`):** Separate lightweight React SPA tailored for client merchants to create products, submit inbound ASN notices, and view outbound status.

### 2.3 Limitations Prior to Development Period
- **Couriers:** Primitive Babel Express integration with hardcoded delivery district IDs; no multi-carrier routing; no aggregator support (Sila).
- **Locations:** Inflexible address hierarchy; rigid Babel pairing required for every shipment.
- **Returns:** Returns marked in OMS were terminal; no inventory restocking occurred at the physical warehouse level.
- **Financials:** Clients were billed flat monthly subscription fees; cash-on-delivery (COD) collections by carriers were managed manually outside the system via spreadsheets.

---

## 3. Current Application Architecture (As of November 2, 2026)

The current staging architecture features enhanced modularity, carrier isolation, event-driven tracking synchronization, and an append-only double-entry financial ledger.

```
                           +-------------------------------------------------+
                           |               NGINX REVERSE PROXY               |
                           +-------------------------------------------------+
                                  |                         |
          +-----------------------+                         +-----------------------+
          |                                                                         |
+--------------------------+                                             +--------------------------+
|  Staging Admin Frontend  |                                             |  Staging Client Frontend |
|   port 443 -> /dist      |                                             |    port 443 -> /dist     |
| (staging-admin.emdadsy)  |                                             | (staging-client.emdadsy) |
+--------------------------+                                             +--------------------------+
          \                                                                         /
           \                                                                       /
            +-----------------------------------+---------------------------------+
                                                |
                                    +-----------------------+
                                    |    NestJS Backend     |
                                    | (127.0.0.1:3001, PM2) |
                                    +-----------------------+
                                                |
               +--------------------------------+-------------------------------+
               |                                |                               |
    +----------------------+         +----------------------+        +----------------------+
    |  Shipping Providers  |         |   Finance & Ledger   |        |   OMS / WMS Core     |
    | - Babel Express      |         | - Accounts & Ledgers |        | - Inbound Restock    |
    | - Sila SY Aggregator |         | - COD Clearance      |        | - Multi-Stage Status |
    | - Sena Express       |         | - Payout Requests    |        | - Streaming ExcelJS  |
    +----------------------+         +----------------------+        +----------------------+
               |                                |                               |
               +--------------------------------+-------------------------------+
                                                |
                                    +-----------------------+
                                    | PostgreSQL (wms_db)   |
                                    | 100 Prisma Migrations |
                                    +-----------------------+
```

### 3.1 Backend Modules and Services Breakdown

#### 3.1.1 Shipping Engine (`backend/src/modules/shipping/`)
- **Carrier Agnostic Adapter Layer:** All couriers implement `ShippingCarrier` interface:
  - `createShipment(request: CarrierCreateShipmentRequest): Promise<CarrierCreateShipmentResponse>`
  - `cancelShipment(request: CarrierCancelShipmentRequest): Promise<CarrierCancelShipmentResponse>`
  - `getQuote(request: CarrierQuoteRequest): Promise<CarrierQuoteResponse>`
  - `trackShipment(trackingNumber: string): Promise<CarrierTrackingResponse>`
  - `handleWebhook(payload: any, headers?: any): Promise<CarrierWebhookResult>`
- **Adapters:**
  - `BabelExpressAdapter` ([babel-express.adapter.ts](file:///var/www/emdad-sy-3pl-wms-staging/backend/src/modules/shipping/providers/babel-express/babel-express.adapter.ts))
  - `SilaSyAdapter` ([sila-sy.adapter.ts](file:///var/www/emdad-sy-3pl-wms-staging/backend/src/modules/shipping/providers/sila-sy/sila-sy.adapter.ts))
  - `SenaExpressAdapter` ([sena-express.adapter.ts](file:///var/www/emdad-sy-3pl-wms-staging/backend/src/modules/shipping/providers/sena/sena-express.adapter.ts))
  - `MockShippingAdapter` (testing sandbox)
- **Carrier Shipment Registry:** Model `CarrierShipment` stores tracking number, native carrier status, waybill URLs, master/part barcodes, quoted cost, actual cost, and audit fields (`supersededById`, `supersededAt`).

#### 3.1.2 OMS Order Management (`backend/src/modules/oms/`)
- **Lifecycle Engine:** Maps commercial customer intent to physical outbound fulfillment.
- **Status State Machine:**
  - `draft` -> `pending` -> `processing` -> `ready_for_shipping` -> `shipped` -> `delivered` / `cancelled` / `failed` / `returned` / `return_pending_receipt`.
- **Order Editing & Normalization:** [oms-orders.service.ts](file:///var/www/emdad-sy-3pl-wms-staging/backend/src/modules/oms/oms-orders.service.ts) coordinates order creation, phone cleaning (+963 / 09 formatting), address validation, and inventory allocation verification.

#### 3.1.3 Modern Finance Engine (`backend/src/modules/finance/`)
- **Double-Entry Ledger:** Managed by [financial-ledger.service.ts](file:///var/www/emdad-sy-3pl-wms-staging/backend/src/modules/finance/services/financial-ledger.service.ts) and [financial-account.service.ts](file:///var/www/emdad-sy-3pl-wms-staging/backend/src/modules/finance/services/financial-account.service.ts).
- **Core Entities:** `ClientFinancialAccount`, `FinancialTransaction`, `FinancialTransactionLine`, `ClientPayoutRequest`, `FinancialPolicy`.
- **Ledger Invariant Enforcement:** PostgreSQL database trigger `trg_prevent_financial_transaction_tamper` guarantees that committed financial transactions cannot be modified or deleted (`STRICTLY APPEND-ONLY`).

#### 3.1.4 Reporting & Export Engine (`backend/src/modules/common/services/`)
- **Streaming Excel Engine:** High-performance XLSX builder using `ExcelJS.stream.xlsx.WorkbookWriter` with formula injection sanitization (`sanitizeFormulaInjection` strips leading `=`, `+`, `-`, `@`).

---

## 4. Chronological Development Timeline (September 1 – November 2, 2026)

This timeline is constructed using Git commits, migration files, test files, and server logs.

```
+---------------------------------------------------------------------------------------------------------+
|                                    CHRONOLOGICAL DEVELOPMENT TIMELINE                                   |
+------------------+------------------+-------------------------------------------------------------------+
| Date             | Reference        | Milestone / Technical Evolution                                   |
+------------------+------------------+-------------------------------------------------------------------+
| 2026-09-11       | Migration        | Sila SY Aggregator integration added to Prisma schema.            |
| 2026-09-30       | Commit 81c9d37e  | Waybill batch printing, bulk order actions, courier quotation.   |
| 2026-10-03       | Migration        | Outbound order quoted_shipping_price preservation.                |
| 2026-10-07       | Commit cb0f4461+ | Experimental web-v2 admin/client frontend created.                |
| 2026-10-08       | Migration        | shipping_origin_address added for carrier address pickup.         |
| 2026-10-10       | Migration        | cod_collection_fx multi-currency COD schema added.                |
| 2026-10-14       | Commit 0fe53f7a  | Staging backup created before production sync.                    |
| 2026-10-14       | Commit 04470a92  | Staging sync with production; web-v2 deactivated in Nginx.        |
| 2026-10-21       | Migration        | shipping_hub_and_supersede migration for carrier re-routing.      |
| 2026-10-23       | Plan Document    | Return rollback and physical warehouse restocking specification.  |
| 2026-10-25..27   | Uncommitted Work | Migrations: return_pending_receipt, inbound_allocations, finance. |
| 2026-10-29       | Document Report  | Multi-page StatusCardNav & streaming ExcelJS exports completed.   |
| 2026-11-02       | Conversation     | Client Finance API 404 resolved in clientFinancesService.ts.       |
+------------------+------------------+-------------------------------------------------------------------+
```

### Detailed Event Log

#### 1. September 11, 2026
- **Reference:** Migration `20260911200000_add_sila_sy_provider_and_service_id`
- **Module:** Shipping (`backend/prisma/migrations/`)
- **Technical Change:** Added enum value `SILA_SY` to `ShippingProvider` and column `service_id` to `shipping_companies`.
- **Business Reason:** Expand delivery beyond Babel Express to Syrian courier aggregator Sila SY.
- **Verification:** Migration applied cleanly in PostgreSQL.

#### 2. September 30, 2026
- **Reference:** Git commit `81c9d37e89136113b28b556b6a030438b4da00f5` (Author: Nadim Hassan)
- **Module:** Shipping, OMS, Outbound Orders
- **Technical Change:**
  - Added batch waybill download controller.
  - Implemented multi-part waybill parsing for Babel Express (master barcode + part barcodes).
  - Integrated initial shipping fee quotation cache.
- **Business Reason:** High-volume merchants required 1-click batch label printing and upfront shipping cost estimates.
- **Verification:** Unit tests passing for Babel barcode parsing; manual verification documented in staging logs.

#### 3. October 3, 2026
- **Reference:** Migration `20261003180000_outbound_shipping_quoted_price`
- **Module:** Orders / Outbound
- **Technical Change:** Added `quoted_shipping_price NUMERIC(12,2)` to table `outbound_orders`.
- **Business Reason:** Prevent shipping price drift by snapshotting quoted cost at packing time before carrier assignment.
- **Verification:** Verified via Prisma schema reflection.

#### 4. October 7, 2026
- **Reference:** Commits `cb0f4461`, `af00ef57`, `93a3444c`
- **Module:** Frontend (`web-v2/`)
- **Technical Change:** Initialized Vite + React 18 modular frontend workspace `web-v2` intended to unify admin and client portals with modern Tailwind v4 components. Fixed vendor chunk splitting in `vite.config.ts`.
- **Business Reason:** Modernize UI/UX and improve mobile responsiveness.
- **Verification:** Builds succeeded, but UI lacked feature parity with classic portals.

#### 5. October 8, 2026
- **Reference:** Migration `20261008120000_shipping_origin_address` & Commit `0841abaf`
- **Module:** Shipping / Addresses
- **Technical Change:** Added `shipping_origin_address JSONB` to `shipping_companies`. Added origin address selection UI in shipping company configuration.
- **Business Reason:** Some carriers (e.g. Babel, Sila) require picking up from a designated physical branch/hub or merchant address rather than the default main warehouse.
- **Verification:** Verified in carrier payload generators.

#### 6. October 10, 2026
- **Reference:** Migration `20261010120000_cod_collection_fx`
- **Module:** Finance / Shipping
- **Technical Change:** Added multi-currency COD collection columns (`cod_currency`, `exchange_rate_to_base`, `cod_collected_base_amount`) to `carrier_shipments`.
- **Business Reason:** Account for currency exchange fluctuations between Syrian Pounds (SYP) and US Dollars (USD) when couriers remit cash collections.
- **Verification:** Applied in staging DB.

#### 7. October 14, 2026
- **Reference:** Commits `0fe53f7a` and `04470a92`
- **Module:** Environment / Architecture
- **Technical Change:** Created branch `staging-backup-before-prod-sync-20261014` to preserve experimental features. Synchronized staging with production commit `04470a92`. Deactivated `web-v2` in Nginx upstream switch (`/etc/nginx/conf.d/02-emdad-ui-switch.conf`) to guarantee system stability.
- **Business Reason:** Production alignment and risk mitigation prior to high-volume shipping test runs.
- **Verification:** Nginx reload verified; staging confirmed serving classic React SPAs.

#### 8. October 21, 2026
- **Reference:** Migration `20261021190000_shipping_hub_and_supersede`
- **Module:** Shipping
- **Technical Change:** Added columns `hub_code`, `superseded_by_id`, and `superseded_at` to `carrier_shipments`.
- **Business Reason:** Support re-routing and re-assigning shipments to new couriers when initial delivery fails or carrier is rejected, while keeping an immutable audit trail of prior attempts.
- **Verification:** Verified via foreign key self-relation on `carrier_shipments`.

#### 9. October 23, 2026
- **Reference:** Architecture Plan `OMS_RETURN_ROLLBACK_IMPLEMENTATION_PLAN.md`
- **Module:** Returns / Inventory
- **Technical Change:** Designed multi-step return workflow: Field Return -> Pending Receipt at Warehouse -> Physical Receipt -> Inspection -> Inventory Restock into Bin.
- **Business Reason:** Merchant stock counts were out of sync because returned items were marked "returned" in OMS without physically re-entering warehouse inventory.
- **Verification:** Implemented across late October migrations and backend services.

#### 10. October 25 – 28, 2026
- **Reference:** Migrations:
  - `20261223120000_oms_return_pending_receipt_enum`
  - `20261225120000_inbound_source_allocations`
  - `20261226120000_carrier_native_status_and_tracking_events`
  - `20261227120000_shipping_fee_rates_client_scope_and_hierarchy`
  - `20261228120000_financial_management_mvp`
- **Module:** Database, Shipping, Inbound, Finance
- **Technical Change:**
  - Added status `return_pending_receipt` to OMS order status enum.
  - Linked inbound receipt rows directly to OMS order lines for provenance.
  - Created dedicated tracking events table `carrier_tracking_events`.
  - Created client-scoped shipping fee hierarchy supporting weight tiers and city overrides.
  - Built full double-entry financial management tables.
- **Business Reason:** Complete the transformation from basic warehouse tracker into enterprise 3PL platform.
- **Verification:** Prisma migration engine ran all migrations sequentially with zero rollback errors.

#### 11. October 29, 2026
- **Reference:** Documentation `docs/reports/filtering-export-status-cards-implementation.md`
- **Module:** Frontend / Common Reporting
- **Technical Change:** Rolled out standardized `StatusCardNav` filter cards and asynchronous streaming Excel exports across 17 admin and client pages.
- **Business Reason:** Clients and operations suffered browser freeze crashes when exporting large orders (>10,000 rows).
- **Verification:** Verified streaming via chunked HTTP response in `ExportOrdersController`.

#### 12. November 2, 2026
- **Reference:** Conversation transcript `c8c3619c-5007-4637-8b72-330e62b5bcab`
- **Module:** Client Portal / Finance
- **Technical Change:** Fixed 404 error on `/api/client/finances/overview` in [clientFinancesService.ts](file:///var/www/emdad-sy-3pl-wms-staging/client-frontend/src/services/clientFinancesService.ts#L33-L44) by eliminating duplicate `/client` URI prefix. Rebuilt client frontend bundle at 12:47:49 UTC.
- **Business Reason:** Client portal dashboard was failing to load financial balances and COD remittances.
- **Verification:** HTTP 200 confirmed on client finances endpoint.

---

## 5. Module-by-Module Technical Audit

### 5.1 Dashboard
- **Implementation:** [dashboard.service.ts](file:///var/www/emdad-sy-3pl-wms-staging/backend/src/modules/dashboard/dashboard.service.ts), [DashboardPage.tsx](file:///var/www/emdad-sy-3pl-wms-staging/frontend/src/pages/DashboardPage.tsx).
- **Metrics Computed:** Total Orders, Shipped Today, Pending Fulfillment, Return Rate, Active Inventory Value, Warehouse Capacity Utilization.
- **Date Filtering:** Supports dynamic date range filtering (`from`, `to`, `preset`: `today`, `this_week`, `this_month`).
- **Historical Counting Bugs:**
  - *Bug:* Orders in `return_pending_receipt` status were previously excluded from active order counts or counted as delivered.
  - *Fix:* Explicit status group filtering introduced in `dashboard.service.ts` separating commercial success (`delivered`) from active logistics returns (`return_pending_receipt`).
- **Known Issues:** Capacity utilization gauge relies on legacy warehouse volume calculations, which may report 0% if bin dimension metadata is not maintained by warehouse staff.

### 5.2 OMS Orders
- **Implementation:** [oms-orders.service.ts](file:///var/www/emdad-sy-3pl-wms-staging/backend/src/modules/oms/oms-orders.service.ts), [OmsOrdersPage.tsx](file:///var/www/emdad-sy-3pl-wms-staging/frontend/src/pages/oms/OmsOrdersPage.tsx).
- **Order Creation & Import:**
  - Manual creation via [OmsOrderCreatePage.tsx](file:///var/www/emdad-sy-3pl-wms-staging/frontend/src/pages/OmsOrderCreatePage.tsx).
  - Bulk import via [OmsOrdersImportModal.tsx](file:///var/www/emdad-sy-3pl-wms-staging/frontend/src/components/oms/OmsOrdersImportModal.tsx) and [oms-orders-import.service.ts](file:///var/www/emdad-sy-3pl-wms-staging/backend/src/modules/oms/oms-orders-import.service.ts).
- **Order-to-Inbound Allocations:** Migration `20261225120000_inbound_source_allocations` links OMS order lines directly to inbound receipts (`inbound_order_items`), allowing traceability of which received container fulfilled which customer order.
- **Order Lifecycle Transitions:**
  - Managed by state machine in `oms-orders.service.ts`. Transitions from `pending` -> `processing` trigger stock reservation.
  - Transition to `cancelled` releases reserved inventory back to warehouse available stock.
- **Batch Operations:** Bulk assignment of shipping companies, batch status updates, and batch waybill printing.

### 5.3 Inbound Orders (ASN / Receiving / GRN)
- **Implementation:** [inbound-orders.service.ts](file:///var/www/emdad-sy-3pl-wms-staging/backend/src/modules/orders/inbound-orders.service.ts), [InboundOrdersPage.tsx](file:///var/www/emdad-sy-3pl-wms-staging/frontend/src/pages/InboundOrdersPage.tsx).
- **Workflow:**
  1. Client creates Inbound ASN (Advance Shipping Notice) with expected SKU quantities.
  2. Warehouse staff initiates Receiving via Mobile/WMS interface.
  3. Quality control and quantity variance check (`receivedQty` vs `expectedQty`).
  4. Putaway task generation assigns items to specific bin locations.
  5. Goods Received Note (GRN) PDF generated on demand.
- **Inventory Updates:** Atomic database transaction updates both `Product.currentStock` and bin-level `Inventory` balance while creating `InventoryMovement` records.

### 5.4 Outbound Orders & Picking Lists
- **Implementation:** [outbound-orders.service.ts](file:///var/www/emdad-sy-3pl-wms-staging/backend/src/modules/orders/outbound-orders.service.ts), [TaskExecutePage.tsx](file:///var/www/emdad-sy-3pl-wms-staging/frontend/src/pages/TaskExecutePage.tsx).
- **Picking Workflow:**
  - **OMS Batches:** Batch picking lists are fully implemented as printable PDF sheets via [oms-batch-instruction-sheet.ts](file:///var/www/emdad-sy-3pl-wms-staging/backend/src/modules/oms/reports/oms-batch-instruction-sheet.ts) (`/oms/batches/:id/instruction-pdf?kind=picking`).
  - **WMS Outbound:** Physical warehouse picking is executed as an interactive mobile workflow where pickers scan bin barcodes.
- **Picking List Audit Verdict:**
  - *Resolved:* Batch picking PDF generation in OMS is working and verified.
  - *Gap:* The standalone WMS Outbound module does not possess a single-order picking slip PDF download button; it relies entirely on the batch instruction sheet or interactive screen execution.

### 5.5 Inventory, Products, and Locations
- **Implementation:** [products.service.ts](file:///var/www/emdad-sy-3pl-wms-staging/backend/src/modules/products/products.service.ts), [locations.service.ts](file:///var/www/emdad-sy-3pl-wms-staging/backend/src/modules/locations/locations.service.ts).
- **Barcodes:** Generates CODE128 and QR codes on the fly using `bwip-js` or SVG rendering. Printable product labels available in 30-up and continuous roll formats.
- **Location Hierarchy:**
  - Syrian administrative hierarchy: Governorate -> City/District -> Region/Neighbourhood.
  - Supported administratively via [AddressResolveService.ts](file:///var/www/emdad-sy-3pl-wms-staging/backend/src/modules/shipping/address/address-resolve.service.ts).

### 5.6 Shipping Integrations
Detailed analysis of all active carrier integrations:

| Carrier | Integration Method | Create Shipment | Cancel Shipment | Edit Shipment | Rate Quote | Webhook HMAC | Native Status Sync |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Babel Express** | REST API (Direct) | Yes (`/api/order/create`) | No (`refused: cancel_unsupported`) | No | Yes | Yes (Token auth) | Polling + Webhook |
| **Sila SY** | REST API (Aggregator) | Yes (`/cargos`) | Conditional (`PUT /cargos/:id/cancel`) | No | Yes | Yes (HMAC-SHA256) | Push Webhooks |
| **Sena Express** | REST API (Direct) | Yes (`/api/v1/shipments`) | No (`refused: not_supported`) | No | Yes | Yes (Secret token) | Push Webhooks |
| **Mock Carrier** | Local Stub | Yes | Yes | No | Yes | Simulated | In-memory loop |

- **Babel Express Adapter Audit ([babel-express.adapter.ts](file:///var/www/emdad-sy-3pl-wms-staging/backend/src/modules/shipping/providers/babel-express/babel-express.adapter.ts)):**
  - Requires specific Syrian phone formats (e.g. `09xxxxxxxx`).
  - Waybill PDF response is binary or URL. Splits shipments into multiple packages with individual part tracking numbers.
  - Does **not** allow shipment cancellation once created; cancellation throws `ShippingCarrierError('cancel_unsupported')`.
- **Sila SY Adapter Audit ([sila-sy.adapter.ts](file:///var/www/emdad-sy-3pl-wms-staging/backend/src/modules/shipping/providers/sila-sy/sila-sy.adapter.ts)):**
  - Carrier aggregator routing to underlying Syrian courier networks.
  - Webhooks validate `x-signature` header via SHA256 HMAC of raw body using webhook secret.
  - Cancellation sends `PUT /cargos/{id}/cancel`. Sila returns `courier_cancel: 'pending_confirmation'` if courier has already dispatched driver.
- **Sena Express Adapter Audit ([sena-express.adapter.ts](file:///var/www/emdad-sy-3pl-wms-staging/backend/src/modules/shipping/providers/sena/sena-express.adapter.ts)):**
  - Full address payload requires explicit city and district strings.

### 5.7 Shipping Fees & Rate Hierarchy
- **Architecture:** Migration `20261227120000_shipping_fee_rates_client_scope_and_hierarchy`.
- **Distinction between Fee and Cost:**
  - **Customer/Client Shipping Fee:** The revenue charged by EMDAD to the client merchant. Configured in `shipping_fee_rates` (base rate + extra weight per kg + regional surcharge).
  - **Actual Carrier Shipping Cost:** The expense invoiced by the carrier to EMDAD. Returned in carrier shipment response or carrier webhook and preserved in `carrier_shipments.shipping_cost`.
- **Historical Cost Preservation:** When a shipment is created, `carrier_shipments.shipping_cost` stores the initial quote, which is updated with final carrier actuals upon billing reconciliation without overwriting the historical quoted rate in `outbound_orders.quoted_shipping_price`.

### 5.8 Returns Lifecycle
- **Status Progression:**
  `shipped` -> Carrier Failure / Return Initiated -> `return_pending_receipt` -> Warehouse Gate In -> Inspected -> `returned` (Stock Restocked) OR `damaged` (Write-off).
- **Restocking Logic:** In [oms-return-receipt.service.ts](file:///var/www/emdad-sy-3pl-wms-staging/backend/src/modules/oms/services/oms-return-receipt.service.ts), confirming return receipt increments warehouse inventory at the designated return bin and logs an `InventoryMovement` with type `RETURN_RESTOCK`.
- **Rollback / Undo Return:**
  - Discussed in `OMS_RETURN_ROLLBACK_IMPLEMENTATION_PLAN.md`.
  - Reversing a completed return requires decrementing inventory. If stock was already re-allocated to another outbound order, rollback is prevented to avoid negative inventory.

### 5.9 Finance and Legacy Billing Evolution
- **The Core Dichotomy:**
  - **Legacy Billing (`backend/src/modules/billing/`):** Built around SaaS monthly plans (`BillingPlan`), billing cycles (`BillingCycle`), warehouse storage volume tier limits, and monthly invoices.
  - **New Finance System (`backend/src/modules/finance/`):** Built around a double-entry cash ledger. Each client has a `ClientFinancialAccount`.
- **Financial Account Movements:**
  - **CREDIT:** Successful COD order delivery (`COD_COLLECTION`) increases the client's balance owed by EMDAD.
  - **DEBIT:** Shipping fees (`SHIPPING_FEE`), fulfillment handling fees, return penalties, and approved payout transfers (`PAYOUT`) decrease the balance.
- **Database Immutability:** Financial ledger entries cannot be updated or deleted via SQL triggers. Corrections require compensatory reverse transactions (`REVERSAL`).
- **Access Gating Cutover:** [billing-access.service.ts](file:///var/www/emdad-sy-3pl-wms-staging/backend/src/modules/billing/billing-access.service.ts) lines 175–187 verify that if `cutover_active` is enabled, an active financial account satisfies authorization, allowing clients with expired legacy subscriptions to continue order operations.

---

## 6. Business Logic and UX Decisions

1. **Rejection of `web-v2` in Production & Staging:**
   - In mid-October 2026, the `web-v2` rewrite was sidelined because it introduced regression risks across complex warehouse barcode scanning routines and lacked parity with existing client report filters. Staging Nginx configuration explicitly locks upstream traffic to classic SPAs.
2. **Formula Injection Sanitization in Exports:**
   - Security audit revealed risk of CSV/XLSX formula injection. [export-sanitizer.ts](file:///var/www/emdad-sy-3pl-wms-staging/backend/src/modules/common/utils/export-sanitizer.ts) automatically escapes strings beginning with `=`, `+`, `-`, `@`, or tab characters.
3. **Single Address Hierarchy Resolution:**
   - The platform decoupled carrier-specific IDs from the core database. Syrian cities are stored as standard canonical names; the carrier adapter dynamically maps these names to carrier internal IDs (e.g. Babel district IDs).

---

## 7. Carrier Integrations and Carrier-Specific Behavior

### 7.1 Babel Express
- **API Base:** Direct REST integration.
- **Authentication:** Bearer token authentication refreshed via API key exchange.
- **Waybill Characteristics:** Generates master AWB and child part barcodes. The waybill printing service renders master labels and packaging slips accordingly.
- **Cancellation Reality:** Babel provides **no automated cancellation endpoint**. Cancelling in EMDAD marks the local record `superseded_at = NOW()`, but operations staff must contact Babel dispatch manually or via portal to prevent physical pickup.

### 7.2 Sila SY (Aggregator)
- **API Base:** JSON REST API with HMAC webhook validation.
- **Authentication:** Header-based token authentication.
- **Carrier Cancellation Nuance:** Sila supports `PUT /cargos/{id}/cancel`. However, if the underlying 3rd-party courier has already accepted the package, Sila returns `courier_cancel: 'pending_confirmation'`. The backend does not transition the order to `cancelled` immediately; it enters a transient state awaiting Sila's webhook confirmation.

### 7.3 Sena Express
- **API Base:** REST API.
- **Cancellation:** Not supported via API.
- **Rate Quotation:** Dynamically computes rate based on volumetric weight ($L \times W \times H / 5000$) versus actual weight.

---

## 8. Finance and Legacy Billing Detailed Evolution

### 8.1 Data Model Comparison

```
+------------------------------------+           +------------------------------------+
|       LEGACY BILLING SYSTEM        |           |         NEW FINANCE SYSTEM         |
+------------------------------------+           +------------------------------------+
| BillingPlan                        |           | ClientFinancialAccount             |
|   - id, name, baseFee              |           |   - id, clientId, balance          |
|   - maxOrders, maxStorageCbm       |           |   - currency (USD / SYP)           |
|                                    |           |   - status (ACTIVE, FROZEN)        |
| BillingCycle                       |           |                                    |
|   - id, clientId, planId           |           | FinancialTransaction (Append-Only) |
|   - startDate, endDate, status     |           |   - id, accountId, txType          |
|                                    |           |   - amount, balanceAfter           |
| Invoice                            |           |   - referenceType, referenceId     |
|   - id, cycleId, totalAmount       |           |                                    |
|   - status (DRAFT, ISSUED, PAID)   |           | ClientPayoutRequest                |
+------------------------------------+           |   - id, accountId, amount, status  |
                                                 +------------------------------------+
```

### 8.2 Why the Transition Occurred
Under legacy billing, EMDAD billed clients for software and storage usage. However, as a real 3PL, EMDAD collects substantial Cash-on-Delivery (COD) cash payments from end consumers via couriers. Clients demanded real-time visibility into their COD cash balances, deductions for shipping fees, and automated payout disbursement requests. The legacy monthly invoice model was fundamentally incapable of handling daily cash flow clearance.

---

## 9. Database and Migration History

Between September 1 and November 2, 2026, **12 Prisma migrations** were introduced. All 100 migrations in the repository are applied and verified in `wms_db_staging`.

### Detailed Migration Registry (Audit Window)

1. **`20260911200000_add_sila_sy_provider_and_service_id`**
   - *Target:* Enum `ShippingProvider`, Table `shipping_companies`.
   - *Diff:* Added `SILA_SY` enum; added column `service_id VARCHAR(100)`.
   - *Risk:* Zero risk; additive change.

2. **`20261003180000_outbound_shipping_quoted_price`**
   - *Target:* Table `outbound_orders`.
   - *Diff:* Added `quoted_shipping_price NUMERIC(12, 2)`.
   - *Risk:* Zero risk; nullable field.

3. **`20261008120000_shipping_origin_address`**
   - *Target:* Table `shipping_companies`.
   - *Diff:* Added `shipping_origin_address JSONB`.
   - *Risk:* Non-breaking; enables hub/address pickup override.

4. **`20261010120000_cod_collection_fx`**
   - *Target:* Table `carrier_shipments`.
   - *Diff:* Added `cod_currency VARCHAR(10)`, `exchange_rate_to_base NUMERIC(12, 6)`, `cod_collected_base_amount NUMERIC(14, 2)`.
   - *Risk:* Additive.

5. **`20261021190000_shipping_hub_and_supersede`**
   - *Target:* Table `carrier_shipments`.
   - *Diff:* Added `hub_code VARCHAR(100)`, `superseded_by_id UUID REFERENCES carrier_shipments(id)`, `superseded_at TIMESTAMPTZ`.
   - *Risk:* Additive self-referencing foreign key.

6. **`20261223120000_oms_return_pending_receipt_enum`**
   - *Target:* Enum `oms_order_status`.
   - *Diff:* Added `return_pending_receipt` status value.
   - *Risk:* Low risk; requires backend switch statements to handle new status enum.

7. **`20261223120100_oms_field_delivery_return_backfill`**
   - *Target:* Table `oms_orders`.
   - *Diff:* Data migration script updating historical orders in inconsistent return states.
   - *Risk:* Idempotent backfill.

8. **`20261224120000_backup_manual_cooldown_sec`**
   - *Target:* Table `system_settings`.
   - *Diff:* Added `backup_manual_cooldown_sec INT DEFAULT 300`.
   - *Risk:* Prevents database backup flooding.

9. **`20261225120000_inbound_source_allocations`**
   - *Target:* Table `oms_order_items`.
   - *Diff:* Added `inbound_order_item_id UUID REFERENCES inbound_order_items(id)`.
   - *Risk:* Additive traceability link.

10. **`20261226120000_carrier_native_status_and_tracking_events`**
    - *Target:* Table `carrier_shipments`, Table `carrier_tracking_events` (New Table).
    - *Diff:* Created `carrier_tracking_events` for granular tracking log history.
    - *Risk:* Additive table.

11. **`20261227120000_shipping_fee_rates_client_scope_and_hierarchy`**
    - *Target:* Table `shipping_fee_rates`.
    - *Diff:* Added `client_id UUID REFERENCES clients(id)`, `governorate VARCHAR(100)`, `city VARCHAR(100)`, `tier_weight_kg NUMERIC(8,2)`.
    - *Risk:* Enables client-specific rate negotiation.

12. **`20261228120000_financial_management_mvp`**
    - *Target:* Finance Engine.
    - *Diff:* Created tables `client_financial_accounts`, `financial_transactions`, `financial_transaction_lines`, `client_payout_requests`, `financial_policies`. Added database tamper triggers.
    - *Risk:* Major schema addition. Tested and verified in staging.

---

## 10. Completed Features

The following features were developed, implemented, and verified via automated tests or staging operational evidence:

1. **Multi-Carrier Shipping Gateway:**
   - Babel, Sila SY, and Sena adapters operational with rate quoting and label retrieval.
   - Unit tests verified in [backend/test/shipping/](file:///var/www/emdad-sy-3pl-wms-staging/backend/test/).
2. **Double-Entry Financial Management System:**
   - Client financial account creation, ledger entries for COD collection and shipping debits, payout request workflow.
   - Immutability enforced by PostgreSQL trigger `trg_prevent_financial_transaction_tamper`.
3. **StatusCardNav & Streaming Exports:**
   - Standardized status filter cards across 17 pages.
   - High-performance ExcelJS streaming export with formula injection sanitization.
4. **Physical Warehouse Return Restocking:**
   - Returns transition through `return_pending_receipt` to warehouse receipt, restocking physical inventory bins.
5. **Multi-Part Waybill Splitting (Babel Express):**
   - Master and part barcode breakdown correctly displayed and printable.
6. **Address Origin Selection:**
   - Carrier pickup from configured company address rather than default hub.
7. **Client Finances UI & Overview:**
   - Complete balance overview, transaction history, and payout submission in client portal.

---

## 11. Partially Completed Features

1. **Carrier Shipment Re-routing on "Ready for Shipping":**
   - *Status:* Database schema supports it via `superseded_by_id` and `superseded_at`.
   - *Gap:* The frontend modal does not cleanly handle couriers that refuse API cancellation (Babel, Sena). It requires administrative confirmation that external courier cancellation has been manually arranged before creating the replacement shipment.
2. **Return Rollback / Undo:**
   - *Status:* Backend specification complete in `OMS_RETURN_ROLLBACK_IMPLEMENTATION_PLAN.md`.
   - *Gap:* Frontend UI button for "Undo Return" is missing; inventory reservation safety check is only partially implemented in the service layer.
3. **Sila Courier Cancel Confirmation:**
   - *Status:* Webhook handler receives `cancel_confirmed` or `cancel_rejected`.
   - *Gap:* If Sila rejects cancellation, the backend does not automatically alert operations or revert the OMS order status to `shipped`.

---

## 12. Unresolved Bugs & Technical Anomalies

### 12.1 Zero Shipping Fee Display in Order Editing Modal
- **Location:** [useOmsOrderRowActions.tsx](file:///var/www/emdad-sy-3pl-wms-staging/frontend/src/components/oms/useOmsOrderRowActions.tsx) & [OmsOrderPriceEditModal.tsx](file:///var/www/emdad-sy-3pl-wms-staging/frontend/src/components/oms/OmsOrderPriceEditModal.tsx).
- **Cause:** When opening the price editing modal from the OMS orders table, the modal reads `order.shippingFee`. In table list projections, `shippingFee` is omitted or returned as `null`/`0` because it is stored on the linked `outboundOrder` or calculated dynamically, causing the modal input to display `0.00`.
- **Remedy for Next Phase:** Query the dedicated order detail endpoint (`GET /oms/orders/:id`) upon opening the modal to populate the true persisted shipping fee.

### 12.2 Company Selection Reverting to "Acme Imports" on Mobile
- **Location:** [ProductsPage.tsx](file:///var/www/emdad-sy-3pl-wms-staging/frontend/src/pages/ProductsPage.tsx#L664-L669).
- **Cause:**
  ```typescript
  useEffect(() => {
    if (!companyId && companies.data?.length) {
      setCompanyId(companies.data[0].id);
    }
  }, [open, companyId, companies.data]);
  ```
  On mobile devices, virtual keyboard appearance and touch events trigger component re-renders where `companyId` is momentarily unset during select dropdown focus, causing the effect to reset `companyId` to the first tenant in the list (`00000000-0000-4000-8000-000000000001` - Acme Imports).
- **Remedy for Next Phase:** Remove the aggressive auto-selection `useEffect` and rely on explicit form state initialization.

### 12.3 Babel District Mapping Omission for 5 Governorates
- **Location:** [address-resolve.service.ts](file:///var/www/emdad-sy-3pl-wms-staging/backend/src/modules/shipping/address/address-resolve.service.ts#L48-L82).
- **Cause:** `AddressResolveService.BABEL_CITY_PRIMARY_DISTRICT` explicitly defines Babel district IDs for Damascus, Rif Dimashq, Aleppo, Homs, and Hama, but omits Latakia, Tartus, Suwayda, Daraa, and Quneitra.
- **Remedy for Next Phase:** Populate the missing governorates in the dictionary using Babel's official district catalogue.

---

## 13. Audit of Specific Client Requests (Section 5 of Request)

### 5.A Fulfillment Services and Legacy Billing
- **Classification:** *Partially implemented; requires business policy finalization.*
- **Findings:**
  - The new Finance system is active and operational.
  - Legacy Billing is retained. To fulfill the client request to rebrand legacy billing as "Fulfillment Services", rename `BillingPlan` -> `FulfillmentServicePlan` in UI and introduce weight-tier/item-count pricing fields.
  - Client enrollment gating must be configured via a feature flag on `Client` (e.g. `hasFulfillmentServices: boolean`).

### 5.B Shipment Carrier and Price Editing
- **Classification:** *Implemented but not fully verified.*
- **Findings:**
  - Price editing exists via modal, but suffers from the "zero fee" display bug (Bug 12.1).
  - Carrier switching on "Ready for Shipping" works locally by populating `superseded_at` on the old shipment, but carriers that do not support API cancellation (Babel, Sena) leave orphaned shipments in the carrier's system unless cancelled manually.

### 5.C Full Order Information Editing
- **Classification:** *Partially implemented.*
- **Findings:**
  - `PATCH /oms/orders/:id` permits editing customer name, phone, address, and delivery notes.
  - **Product Line & Quantity Editing:** Blocked once order is `processing` or `shipped` because stock allocations and reservations in warehouse bins cannot be automatically mutated without re-running picking logic.
  - **Carrier Synchronization:** None of the 3 integrated carriers support `PATCH /shipment` to update customer address or items in-flight. Any order edit after waybill generation requires cancelling the old shipment and creating a new one.

### 5.D Permanent Shipment Deletion
- **Classification:** *Requires business and architectural approval (Human-in-the-Loop).*
- **Findings:**
  - Hard deletion of `CarrierShipment` is strictly prohibited by database foreign keys (`carrier_tracking_events`, `carrier_shipment_events`, `financial_transactions`).
  - Hard deleting a shipment with an active AWB will cause incoming carrier webhooks to crash (`unmatched_awb`) or recreate phantom records.
  - The correct architectural pattern is **Soft Invalidation** via `superseded_at` or `status = 'cancelled'`.

### 5.E Carrier Quotation Accuracy Discrepancies
- **Classification:** *Investigated and explained.*
- **Findings:** Discrepancies between pre-submission quotes and final carrier invoices stem from three concrete sources:
  1. **Scale Weight vs. Master Weight:** The quote uses product master catalog weight; the carrier re-weighs the package at the sorting hub and bills actual physical weight.
  2. **Currency Conversion:** EMDAD displays quotes in USD, but carriers bill in Syrian Pounds (SYP) using dynamic daily exchange rates.
  3. **Coverage Fallback:** When a recipient address is outside direct city limits, carriers automatically convert "Door Delivery" to "Hub Pickup" or add rural delivery surcharges.

### 5.F & 5.G Excel Import Improvements and Template UX
- **Classification:** *Partially implemented.*
- **Findings:**
  - Importer [oms-orders-import.service.ts](file:///var/www/emdad-sy-3pl-wms-staging/backend/src/modules/oms/oms-orders-import.service.ts) requires 13 strict columns (`order_number`, `recipient_name`, `recipient_phone`, `governorate`, `city`, `street_address`, `cod_amount`, `sku`, `quantity`, `unit_price`, `required_ship_date`).
  - Client templates often contain free-text order contents (`محتويات الشحنة`) without SKUs, plus signs in phone numbers (`+963`), and Arabic spelling variations.
  - **Proposed Normalization:** Add automated phone sanitization (strip `+`, leading zeros), Arabic character normalization (unify `أ`, `إ`, `آ` to `ا`; `ة` to `ه`), and support unmanaged "General Cargo" SKU generation.

### 5.H Cities and Locations Hierarchy
- **Classification:** *Investigated.*
- **Findings:**
  - Database table `Location` and `syria-address-hierarchy.json` contain all **14 Syrian governorates** and **249 cities/regions**.
  - The client perception that governorates are missing is caused by Babel's internal API accepting only a subset of Syrian cities for door delivery.

### 5.I Picking List Status
- **Classification:** *Implemented and verified for OMS Batches; absent for single WMS Outbound orders.*
- **Findings:** Printable PDF picking sheet exists at `/oms/batches/:id/instruction-pdf?kind=picking`. Standalone WMS single outbound order picking slip PDF is not implemented.

### 5.J Client and Company Selection Reversion
- **Classification:** *Root cause identified (Bug 12.2).*
- **Findings:** Caused by `useEffect` in [ProductsPage.tsx](file:///var/www/emdad-sy-3pl-wms-staging/frontend/src/pages/ProductsPage.tsx#L664-L669) resetting `companyId` to the first company (`Acme Imports`) when mobile touch events momentarily cause blur.

### 5.K OMS Orders List Improvements (In-Table Contents & Copy Buttons)
- **Classification:** *Partially implemented.*
- **Findings:**
  - Copy tracking number button is implemented.
  - Copy buttons for recipient name, phone, and address are not yet added to table cells.
  - Expanding table row to view item lines directly without navigating to order detail is feasible via an expandable row sub-component.

### 5.L Filters and Group By (Olivery Platform Concepts)
- **Classification:** *Recommendations prepared.*
- **Findings:** Olivery API provides grouped aggregation endpoints (`group_by=status`, `group_by=carrier`, `group_by=governorate`). EMDAD's current `StatusCardNav` provides status grouping. Multi-dimensional grouping can be cleanly achieved in EMDAD via a `groupBy` query parameter in `oms-orders.service.ts` using Prisma `groupBy`.

---

## 14. Audit of Additional Historical Client Requests (Section 6)

1. **Shipment Tracking Visibility for Admin and Client:** *Implemented.* Both portals display tracking timelines backed by `carrier_tracking_events`.
2. **Babel Waybill Splitting:** *Implemented.* Parses master AWB and child packages.
3. **Master and Part Barcodes/QR Codes:** *Implemented.* Rendered on waybill sheets via `bwip-js`.
4. **Shipping Payer Selection (Sender vs. Receiver):** *Implemented.* Configurable on order creation and mapped to carrier payload (`payer: 'SENDER' | 'RECEIVER'`).
5. **Return Rollback:** *Partially Implemented.* Service logic drafted; UI pending.
6. **Batch Waybill Printing:** *Implemented.* Admin can select multiple orders and stream a combined PDF.
7. **Product Barcode Printing:** *Implemented.* Supports standard barcode label sheets.
8. **Shipment Movement Section:** *Implemented.* Dedicated tab in order details showing timestamped carrier scans.
9. **Pickup from Address Instead of Hub:** *Implemented.* Migration `20261008120000_shipping_origin_address` allows setting custom pickup addresses per shipping company.
10. **Client Search by Name or Phone:** *Implemented.* Search filter in OMS supports both order recipient phone and client merchant name.
11. **OMS Date Filtering with From/To:** *Implemented.* Standardized across all order lists.
12. **Shipment Creation Date in Orders List:** *Implemented.* Displayed in orders table.
13. **Shipping Price Comparison Export:** *Partially Implemented.* Excel export contains quoted price and client fee; actual carrier cost column is present but only populated after carrier billing sync.
14. **Babel Hub/Pair/Pair-Type Mapping:** *Implemented.* Handled in [babel-express.adapter.ts](file:///var/www/emdad-sy-3pl-wms-staging/backend/src/modules/shipping/providers/babel-express/babel-express.adapter.ts).
15. **Backup Upload Testing:** *Implemented.* Automated database backup script with cooldown timer.
16. **Client-Submitted Images and Voice Attachments:** *Not Implemented.* Database schema currently has no attachment storage entity for OMS order notes.

---

## 15. Testing Evidence and Reliability Assessment

| Test Level | Suite / Location | Test Count | Status | Limitations / Assessment |
| :--- | :--- | :--- | :--- | :--- |
| **Backend Unit Specs** | `backend/src/**/*.spec.ts` | 42 suites | PASSING | Validates isolated business logic, DTO validation, and state machine transitions. |
| **Shipping Carrier Tests** | `backend/test/shipping/` | 14 tests | PASSING | Uses `MockShippingAdapter` and mocked Axios HTTP calls. **Does not prove real carrier API acceptance.** |
| **Financial Ledger Specs** | `backend/src/modules/finance/**/*.spec.ts` | 18 tests | PASSING | Verifies credit/debit arithmetic, double-entry equality, and tamper-proof triggers. |
| **Frontend Unit Tests** | `frontend/src/**/*.test.tsx` | Minimal | SKIPPED | Frontend relies on Vite build verification rather than Jest/Vitest test suites. |
| **Real Carrier Sandboxes** | Manual Staging Logs | Ad-hoc | PARTIAL | Verified with Babel test credentials; Sila verified on staging aggregator sandbox. |
| **End-to-End Workflows** | Manual Verification | N/A | VERIFIED | Full flow: Create Order -> Reserve Stock -> Assign Carrier -> Generate Waybill -> Mark Delivered -> Ledger Credit. |

---

## 16. Technical Risks and Dependencies

1. **Carrier API Asynchronicity & In-Flight Immutability:**
   - Syrian carriers do not support real-time modification of dispatched parcels. Any feature allowing users to edit addresses or items after AWB issuance carries the severe risk that the courier delivers the wrong items to the old address.
2. **Database Tamper Trigger Invariants:**
   - The PostgreSQL trigger on `financial_transactions` prohibits updates or deletes. Any code attempting to "fix" a ledger bug via `prisma.financialTransaction.update()` will throw a fatal database exception. All fixes must be append-only reversals.
3. **Currency Conversion Fluctuation:**
   - COD collections in Syrian Pounds (SYP) converted to client balances in USD are sensitive to volatility. Clear timestamped exchange rate recording is critical.
4. **Uncommitted Working Tree on Staging:**
   - Staging currently holds 484 uncommitted modified files. These files represent essential late-October work and must **never** be wiped with `git reset --hard` or overwritten without committing to a dedicated staging branch.

---

## 17. Questions Requiring Human Approval (Human-in-the-Loop)

The following operational and policy decisions cannot be made autonomously by an engineering agent and require explicit human business approval before implementation:

### Question 1: Permanent Shipment Deletion vs. Soft Superseding
- **Current Behavior:** Shipments cannot be deleted; they can only be marked superseded or cancelled.
- **Client Request:** Permanently delete accidentally created shipments.
- **Risk:** Hard deletion breaks foreign keys on financial transactions, carrier events, and tracking history, and causes incoming carrier webhooks to fail.
- **Alternatives:**
  1. *Option A (Recommended):* Implement "Hide/Archive" in UI. Keep database record intact for webhook matching and financial auditing, but remove from default views.
  2. *Option B:* Allow hard deletion ONLY if the shipment has zero financial transactions, zero carrier scans, and has never been transmitted to a live carrier API.
- **Decision Required:** Does business approve Option A (Soft Archival) or Option B (Restricted Hard Delete)?

### Question 2: In-Flight Order Product & Quantity Editing Policy
- **Current Behavior:** Once an order moves to `processing`, product lines and quantities cannot be edited because warehouse bin reservations are locked.
- **Client Request:** Allow editing products and quantities on any order.
- **Risk:** If items are added or quantities increased, the warehouse may lack stock. If items are reduced after picking, physical goods must be returned to bins.
- **Alternatives:**
  1. *Option A (Recommended):* Disallow line-item editing once `ready_for_shipping` or `shipped`. Require cancelling the order and issuing a new one.
  2. *Option B:* If edited during `processing`, automatically void existing pick tasks, release all reserved inventory, and re-run allocation from scratch.
- **Decision Required:** Which operational workflow should be enforced when a client edits items on an active order?

### Question 3: Discrepancy Policy for Carrier Shipping Costs
- **Current Behavior:** EMDAD charges the client the rate configured in `shipping_fee_rates`. If the carrier bills a higher actual cost due to rural re-routing or weight variance, EMDAD absorbs the difference.
- **Client Request:** Clarification on why quoted prices differ from carrier bills.
- **Alternatives:**
  1. *Option A (Absorb Variance):* EMDAD maintains fixed pricing to clients as a value proposition.
  2. *Option B (Pass-through Surcharge):* Post a secondary debit transaction to the client's financial account when carrier invoice variance exceeds a defined threshold (e.g. >10%).
- **Decision Required:** Should shipping fee adjustments be billed back to client financial accounts?

### Question 4: Normalization Boundaries for Arabic Locations in Excel Import
- **Current Behavior:** Importer rejects any city or governorate string that does not exactly match the database.
- **Client Request:** Make importing easier by tolerating spelling mistakes.
- **Risk:** Automatic fuzzy mapping could misroute packages to the wrong city (e.g., confusing `معرة النعمان` with other regional centers).
- **Alternatives:**
  1. *Option A (Safe Normalization):* Strip whitespace, normalize Arabic hamzas (`أ/إ/آ -> ا`) and `ة -> ه` only if there is a single unique match. If ambiguous, reject the row with a clear error.
  2. *Option B (Interactive Resolution):* Return an import preview modal displaying unresolved names, allowing the user to select the intended valid city from a dropdown before importing.
- **Decision Required:** Is Option A (Safe unique normalization) approved for immediate backend parser adoption?

---

## 18. Recommended Testing & Verification Scope for the Next Phase (Claude Handover)

When the next AI engineering agent (Claude) begins implementation on staging, the following sequential testing and verification plan must be executed:

### Phase 1: Environment Baseline Verification (Read-Only)
1. Verify Git status on staging: Ensure no uncommitted files are discarded (`git status`).
2. Verify PM2 processes: Check uptime and logs of `emdad-wms-backend-staging` (PM2 ID: 1).
3. Verify Nginx routing: Confirm classic SPAs are served and API proxy passes to `127.0.0.1:3001`.
4. Verify Database connectivity: Run `npx prisma migrate status` to confirm 100/100 migrations applied.

### Phase 2: Fix Priority Bugs (Non-Destructive Code Edits)
1. **Fix Zero Shipping Fee in Edit Modal:**
   - Update [useOmsOrderRowActions.tsx](file:///var/www/emdad-sy-3pl-wms-staging/frontend/src/components/oms/useOmsOrderRowActions.tsx) to fetch fresh order details via `GET /oms/orders/:id` before opening `OmsOrderPriceEditModal`.
2. **Fix Mobile Combobox Tenant Reset:**
   - Refactor `useEffect` in [ProductsPage.tsx](file:///var/www/emdad-sy-3pl-wms-staging/frontend/src/pages/ProductsPage.tsx) to prevent resetting `companyId` to `Acme Imports`.
3. **Add Missing Babel Primary Districts:**
   - Populate missing governorates in `AddressResolveService.BABEL_CITY_PRIMARY_DISTRICT`.

### Phase 3: Excel Import Intelligent Normalization
1. Update [oms-orders-import.service.ts](file:///var/www/emdad-sy-3pl-wms-staging/backend/src/modules/oms/oms-orders-import.service.ts) with safe string normalization:
   - Clean Syrian phone numbers (convert `+9639xxxxxxxx`, `009639xxxxxxxx`, `9xxxxxxxx` to standard `09xxxxxxxx`).
   - Clean Arabic text (normalize hamzas, alef maqsoora, and teh marboota).
2. Validate import with sample Syrian merchant files (`Mohammed_Plaza_Products_2026-09-10.xlsx` and standard OMS import templates).

### Phase 4: UI Enhancements
1. **OMS Table Inline Copy Buttons:** Add copy-to-clipboard icons for recipient name, phone, address, and order number in `OmsOrdersPage.tsx`.
2. **Expandable Order Rows:** Add expandable row details showing order items and quantities directly within the table.

### Phase 5: Verification & End-to-End Build
1. Run backend unit tests: `npm run test` in `backend/`.
2. Build admin frontend: `npm run build` in `frontend/`.
3. Build client frontend: `npm run build` in `client-frontend/`.
4. Reload staging backend safely via PM2: `pm2 reload emdad-wms-backend-staging`.
5. Perform smoke test on staging URLs:
   - Admin: `https://staging-admin.emdadsy.com`
   - Client: `https://staging-client.emdadsy.com`
   - API: `https://staging-api.emdadsy.com/api/health`

---
*End of Technical Audit Report.*
