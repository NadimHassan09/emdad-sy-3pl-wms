# EMDAD 3PL WMS — Final Engineering Blueprint
**Version:** 2.0 | **Stack:** NestJS 11 · PostgreSQL 16 · Redis 7 · BullMQ · React + PWA  
**Date:** April 2026

---

## Table of Contents
1. [System Architecture](#1-system-architecture)
2. [Module Map](#2-module-map)
3. [Concurrency & Idempotency Strategy](#3-concurrency--idempotency-strategy)
4. [Critical Flows](#4-critical-flows)
5. [API Design](#5-api-design)
6. [State Machines](#6-state-machines)
7. [Event-Driven Design](#7-event-driven-design)
8. [Security & Multi-Tenancy](#8-security--multi-tenancy)
9. [Observability & Monitoring](#9-observability--monitoring)
10. [Implementation Plan](#10-implementation-plan)
11. [Load Testing Plan](#11-load-testing-plan)
12. [Production Runbook](#12-production-runbook)

---

## 1. System Architecture

### 1.1 Style: Modular Monolith with Extractable Boundaries

Single NestJS application, single PostgreSQL database. Module boundaries enforced by code structure and dependency injection — not network calls. Extraction to microservices is possible module-by-module when warranted by scale.

**Extraction trigger:** >50 active clients OR >10,000 barcode scans/day → extract Billing and Notification first.

### 1.2 Deployment Topology

```
┌──────────────────── NGINX (SSL termination, rate limiting) ──────────────────┐
│  /admin/*    /register/*    /portal/*    /api/v1/*    /api/barcode/*         │
└─────────────────────────────────┬────────────────────────────────────────────┘
                                  │
┌─────────────────────────────────▼────────────────────────────────────────────┐
│                         NestJS Application                                   │
│                                                                               │
│  Auth   Companies  Users  Warehouses  Products  Inventory  Inbound  Outbound│
│  Tasks  Barcode    QC     Billing     Invoicing  Returns   Reports  Notif.   │
│                                                                               │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ EventEmitter2 (in-process bus) → BullMQ (async jobs) → external calls │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
└──────────┬──────────────────────────────────────────┬────────────────────────┘
           │ Prisma (primary write + RLS context)     │ BullMQ
┌──────────▼──────────────┐  ┌──────────────────────▼──────────────────────────┐
│ PostgreSQL PRIMARY       │  │ Redis                                            │
│ ─────────────────────── │  │ ───────────────────────────────────────────────  │
│ All writes               │  │ BullMQ queues (email, snapshot, reports)         │
│ RLS via fn_set_app_ctx  │  │ Idempotency fast-path (volatile-lru partition)   │
└──────────┬──────────────┘  │ Barcode resolution cache (1h TTL)                │
           │ Streaming        │ Token version cache (8h TTL)                     │
┌──────────▼──────────────┐  │ Rate limit counters                              │
│ PostgreSQL REPLICA       │  └─────────────────────────────────────────────────┘
│ Reports module only      │
└─────────────────────────┘
```

### 1.3 NestJS Module Structure

```
src/
├── modules/
│   ├── auth/           # JWT issue + validation, token version check
│   ├── companies/      # Company lifecycle
│   ├── users/          # Internal + client user management
│   ├── warehouses/     # Warehouse + location tree
│   ├── products/       # Catalogue + lots + packages
│   ├── inventory/      # Ledger writes + current_stock engine
│   ├── inbound/        # Inbound order lifecycle + receiving
│   ├── outbound/       # Outbound order lifecycle + picking + shipping
│   ├── tasks/          # Task engine + assignment + workforce
│   ├── barcode/        # Scan routing + label generation
│   ├── qc/             # QC rules + checks + alerts
│   ├── adjustments/    # Stock adjustment + cycle count
│   ├── billing/        # Plan management + transaction engine
│   ├── invoicing/      # Invoice lifecycle + payments
│   ├── returns/        # Return order management
│   ├── notifications/  # Dispatch (in-app + email)
│   └── reports/        # Read-only queries on replica
├── shared/
│   ├── guards/         # JwtAuthGuard, RolesGuard, CompanyGuard
│   ├── interceptors/   # AuditInterceptor, IdempotencyInterceptor
│   ├── filters/        # GlobalExceptionFilter
│   ├── db/             # PrismaService, RlsMiddleware
│   └── events/         # EventBusService (abstracts EventEmitter2)
└── jobs/
    ├── storage-snapshot.job.ts    # Daily billing: pallet-days charge
    ├── overdue-invoices.job.ts    # Hourly: flag + notify overdue
    ├── low-stock-alert.job.ts     # Daily: threshold breach notification
    ├── partition-create.job.ts    # Monthly: create next DB partitions
    ├── idempotency-cleanup.job.ts # Daily: DELETE expired keys
    └── notification-cleanup.job.ts # Daily: prune old read notifications
```

### 1.4 Request Lifecycle

```
Request arrives
  → NestJS JwtAuthGuard: validate JWT signature, extract payload
  → Token version check: Redis GET token_version:{userId} == jwt.tokenVersion?
    If mismatch → 401 Unauthorized
  → RlsMiddleware (runs per-request, before any Prisma query):
      await prisma.$executeRaw`SELECT fn_set_app_context(${userId}, ${companyId}, ${role})`
  → CompanyGuard: for client roles, overwrite any request.body.companyId / query.company_id with jwt.companyId
  → Controller → Service → Prisma queries (all filtered by RLS automatically)
  → AuditInterceptor (AFTER response): insert into audit_logs for mutations
```

---

## 2. Module Map

### Ownership Boundaries

| Module | Owns | Does NOT Own |
|--------|------|-------------|
| Inventory | current_stock, inventory_ledger, stock_reservations | order lifecycle, billing logic |
| Inbound | inbound_orders, inbound_order_lines, line_lots | task creation (emits event), billing (emits event) |
| Outbound | outbound_orders, lines, allocations | stock deduction (calls Inventory), billing (emits event) |
| Tasks | tasks, task_step_logs, worker assignment | inventory writes (calls Inventory), next-task-chain logic |
| Billing | billing_plans, client_billing_plans, billing_transactions | invoice generation (emits event) |
| Invoicing | invoices, invoice_lines, payments | billing transactions (reads only) |
| QC | qc_rules, qc_checks, qc_alerts | inventory quarantine movement (calls Inventory) |
| Barcode | barcodes table, scan resolution | domain-specific validation (calls each module) |

---

## 3. Concurrency & Idempotency Strategy

### 3.1 Stock Write Pattern (Atomic UPSERT)

All stock movements use atomic UPSERT + deduction to eliminate race conditions. No `SELECT ... FOR UPDATE` is used as a validation step.

**Positive movement (receive / return / transfer in):**
```sql
INSERT INTO current_stock
    (company_id, product_id, location_id, warehouse_id, lot_id, quantity_on_hand, last_movement_at)
VALUES ($1, $2, $3, $4, $5, $delta, NOW())
ON CONFLICT ON CONSTRAINT uq_stock_lot_position      -- or uq_stock_bare_position / uq_stock_package_position
DO UPDATE SET
    quantity_on_hand  = current_stock.quantity_on_hand + EXCLUDED.quantity_on_hand,
    version           = current_stock.version + 1,
    last_movement_at  = NOW()
WHERE current_stock.quantity_on_hand + EXCLUDED.quantity_on_hand >= 0;
-- If WHERE fails: INSERT affected 0 rows → application raises NEGATIVE_STOCK error
```

**Negative movement (pick / adjustment / scrap):**
```sql
UPDATE current_stock
SET quantity_on_hand  = quantity_on_hand  - $delta,
    version           = version + 1,
    last_movement_at  = NOW()
WHERE company_id  = $company_id
  AND product_id  = $product_id
  AND location_id = $location_id
  AND (lot_id = $lot_id OR (lot_id IS NULL AND $lot_id IS NULL))
  AND quantity_on_hand - $delta >= 0                   -- no negative stock
  AND quantity_on_hand - $delta >= quantity_reserved;  -- cannot go below reserved
-- Check affected_rows = 1. If 0: raise INSUFFICIENT_STOCK.
```

**Optimistic locking for concurrent picks from same location:**
```sql
-- Application reads: { version: 5, quantity_on_hand: 100 }
UPDATE current_stock
SET quantity_on_hand = quantity_on_hand - $delta,
    version          = version + 1
WHERE id = $id
  AND version = $read_version        -- optimistic lock
  AND quantity_on_hand >= $delta
  AND quantity_on_hand - $delta >= quantity_reserved;
-- 0 rows: retry with fresh read (max 3 retries with exponential backoff: 10ms, 30ms, 100ms)
-- 3 failures: return 409 CONFLICT to worker UI
```

### 3.2 Idempotency Strategy

Every scan endpoint (`/inbound-orders/:id/receive`, `/outbound-orders/:id/pick`) requires an `Idempotency-Key` header (UUID v4, generated once per physical scan by the client).

**Three-tier idempotency:**

```
Tier 1: Redis (fast path, TTL 10min)
  - On request: GET idempotency:{userId}:{key}
  - If hit: return cached response (no DB work)
  - If miss: proceed to Tier 2

Tier 2: DB idempotency_keys table (durable, survives Redis restart)
  - INSERT INTO idempotency_keys (key, user_id, endpoint, ...)
    ON CONFLICT (key) DO NOTHING
  - RETURNING id (if null: key already processed)
  - If already processed: SELECT response_body WHERE key = $key → return it

Tier 3: Transaction boundary
  - If both tier 1 and tier 2 are misses, the DB transaction itself is idempotent
    because current_stock UPSERT is idempotent when re-processing the same delta
  - Inventory ledger INSERT will duplicate on retry, but idempotency key prevents this

After successful processing:
  - UPDATE idempotency_keys SET response_status=200, response_body=$response WHERE key=$key
  - SET Redis idempotency:{userId}:{key} = response (10min TTL)
```

**Redis configuration for idempotency:**
```
# Separate Redis DB or key prefix for non-evictable keys
maxmemory-policy volatile-lru   # only evict keys WITH expiry, preserves keys without TTL
# OR use two Redis instances:
#   redis-cache: allkeys-lru (barcode cache, stock cache)
#   redis-critical: noeviction (BullMQ + idempotency keys)
```

### 3.3 Transaction Boundaries

| Operation | Transaction Scope | What's Inside |
|-----------|-------------------|---------------|
| Receive scan | Single PG transaction | ledger INSERT + current_stock UPSERT + line UPDATE + step_log INSERT |
| Pick scan | Single PG transaction | ledger INSERT + current_stock UPDATE + allocation UPDATE + step_log INSERT |
| Ship order | Single PG transaction | all remaining stock deductions + reservation release + order status UPDATE |
| Invoice generation | Single PG transaction | aggregate billing_tx + insert invoice + insert lines + link tx.invoice_id |
| QC fail | Single PG transaction | stock quarantine move + qc_alert INSERT + qc_check UPDATE |
| Stock adjustment approval | Single PG transaction | validate qty_before + current_stock UPDATE + ledger INSERT per line |

Events (notifications, billing triggers, next-task creation) are emitted **outside** the transaction — after commit. This ensures: if event processing fails, the inventory change is NOT rolled back. Events are async and retry-safe.

---

## 4. Critical Flows

### 4.1 Inbound Receive Flow

```
PRECONDITIONS: Task is IN_PROGRESS, assigned to current user, order status IN_PROGRESS

1. HTTP POST /inbound-orders/:orderId/receive
   Headers: Authorization: Bearer <jwt>, Idempotency-Key: <uuid>

2. IdempotencyInterceptor:
   a. Check Redis → if hit, return cached response
   b. INSERT idempotency_keys ON CONFLICT DO NOTHING
   c. If 0 rows inserted → fetch cached response from DB → return

3. CompanyGuard: verify orderId.company_id == jwt.companyId

4. BEGIN TRANSACTION (serializable isolation NOT needed; row-level locking is sufficient)

5. SELECT task WHERE id=$taskId AND status='in_progress' AND assigned_to=$userId
   FOR UPDATE SKIP LOCKED   -- skip if another request is already processing this task
   → If not found: ROLLBACK → 409 TASK_NOT_AVAILABLE

6. Resolve scannedProductBarcode:
   SELECT p.* FROM products p
   WHERE p.barcode = $scan AND p.company_id = $companyId AND p.status = 'active'
   → If not found: check barcodes table by entity_type='product'
   → If still not found: ROLLBACK → 400 UNKNOWN_BARCODE

7. Validate product against order line:
   SELECT l.* FROM inbound_order_lines l
   WHERE l.inbound_order_id = $orderId AND l.product_id = $resolvedProductId
   → If not found: ROLLBACK → 400 PRODUCT_NOT_ON_ORDER

8. UPSERT lot (if tracking_type = 'lot'):
   INSERT INTO lots (product_id, lot_number, expiry_date, ...)
   ON CONFLICT (product_id, lot_number) DO NOTHING
   RETURNING id; (or SELECT id if conflict)

9. INSERT INTO inventory_ledger (movement_type='inbound_receive', to_location_id=$locationId, quantity=$qty, ...)

10. UPSERT current_stock (positive movement pattern from §3.1)
    → If 0 rows affected (would produce negative — not possible on receive, so this is a programming error): ROLLBACK → 500

11. UPDATE inbound_order_lines
    SET received_quantity = received_quantity + $qty
    WHERE id = $lineId
    → trigger fn_guard_received_quantity fires: rejects > 110% over-receive

12. INSERT INTO task_step_logs (task_id, step_number, step_type='scan_product', ...)

13. Re-evaluate order completion:
    SELECT COUNT(*) FROM inbound_order_lines
    WHERE inbound_order_id = $orderId AND received_quantity < expected_quantity
    → If 0 remaining: update order status to 'completed'

14. COMMIT

15. AFTER COMMIT (outside transaction):
    a. UPDATE idempotency_keys SET response_status=200, response_body=$result
    b. SET Redis idempotency key
    c. EventBus.emit('inbound.line.received', { orderId, lineId, companyId, qty })
       → TaskModule: if all lines received, create PUTAWAY task
       → BillingModule: create INBOUND_HANDLING billing transaction
       → NotificationModule: notify client user

RESPONSE 200:
{
  "lineId": "uuid",
  "productSku": "SKU-1042",
  "quantityReceived": 80,
  "locationName": "WH1-A-03-05",
  "lotNumber": "LOT-2024-11-05",
  "orderProgress": { "linesComplete": 2, "linesTotal": 3 },
  "qcRequired": false
}
```

---

### 4.2 Outbound Pick Flow

```
PRECONDITIONS: Task is IN_PROGRESS, allocation exists and status='allocated'

1. HTTP POST /outbound-orders/:orderId/pick
   Headers: Idempotency-Key: <uuid>

2. Idempotency check (same as receive)

3. BEGIN TRANSACTION

4. SELECT task FOR UPDATE SKIP LOCKED → verify in_progress + assigned

5. SELECT allocation
   WHERE id = $allocationId AND status = 'allocated'
   FOR UPDATE SKIP LOCKED
   → If not found: ROLLBACK → 409 ALLOCATION_UNAVAILABLE

6. Validate scanned location barcode matches allocation.location_id
   → Mismatch: ROLLBACK → 400 WRONG_LOCATION

7. Validate scanned product barcode resolves to allocation.product_id
   → Mismatch: ROLLBACK → 400 WRONG_PRODUCT

8. Validate scanned lot barcode matches allocation.lot_id (if lot-tracked)
   → Mismatch: ROLLBACK → 400 WRONG_LOT

9. UPDATE current_stock (negative movement pattern from §3.1)
   WHERE version = $readVersion (optimistic lock)
   → 0 rows: ROLLBACK → 409 STOCK_CHANGED_RETRY (client retries up to 3 times)

10. UPDATE outbound_allocations
    SET picked_quantity = picked_quantity + $qty,
        status = CASE WHEN picked_quantity + $qty >= allocated_quantity THEN 'picked' ELSE 'allocated' END
    WHERE id = $allocationId

11. UPDATE outbound_order_lines
    SET picked_quantity = picked_quantity + $qty
    WHERE id = allocation.outbound_order_line_id

12. INSERT INTO inventory_ledger (movement_type='outbound_pick', from_location_id=$locationId, ...)

13. INSERT INTO task_step_logs

14. COMMIT

15. AFTER COMMIT:
    a. Update idempotency key
    b. Check if all allocations are 'picked' → if yes: emit 'task.picking.complete' → create PACKING task
    c. Return next pick step (next allocation with status='allocated')
```

---

### 4.3 Ship Order Flow

```
PRECONDITIONS: All allocations 'picked', order status = 'ready_to_ship'

1. HTTP POST /outbound-orders/:orderId/ship
   Body: { carrier, trackingNumber, taskId }

2. BEGIN TRANSACTION

3. SELECT outbound_order WHERE id=$orderId AND status='ready_to_ship' FOR UPDATE

4. Validate all allocations have status='picked' (double check)

5. FOR EACH allocation WHERE status='picked':
   a. INSERT INTO inventory_ledger (movement_type='outbound_pick' is already done)
      — NOTE: ledger entry was already posted at pick time.
      Here, only the final 'outbound_ship' ledger entry is posted if desired (optional).

6. UPDATE stock_reservations
   SET status = 'fulfilled', updated_at = NOW()
   WHERE outbound_order_id = $orderId AND status = 'active'
   → The fn_sync_quantity_reserved trigger fires automatically, decrementing current_stock.quantity_reserved

7. UPDATE outbound_orders
   SET status='shipped', tracking_number=$tracking, carrier=$carrier, shipped_at=NOW()

8. COMMIT

9. AFTER COMMIT:
   a. EventBus.emit('outbound.order.shipped', { orderId, companyId, trackingNumber, linesShipped })
      → BillingModule: create OUTBOUND_HANDLING billing transaction (per shipment + per line)
      → NotificationModule: notify client with tracking number
```

---

### 4.4 Invoice Generation Flow

```
1. HTTP POST /billing/generate-invoice
   Body: { companyId, billingPeriodStart, billingPeriodEnd }
   Role required: finance or super_admin

2. Validate: no 'draft' or 'posted' invoice exists for same company + overlapping period

3. Fetch active billing plan:
   SELECT cbp.*, bp.*
   FROM client_billing_plans cbp JOIN billing_plans bp ON bp.id = cbp.billing_plan_id
   WHERE cbp.company_id = $companyId AND cbp.status = 'active'
   → If not found: 422 NO_ACTIVE_BILLING_PLAN

4. BEGIN TRANSACTION

5. Aggregate uninvoiced transactions for the period:
   SELECT charge_type, SUM(amount) AS subtotal, COUNT(*) AS tx_count, ARRAY_AGG(id) AS tx_ids
   FROM billing_transactions
   WHERE company_id = $companyId
     AND invoice_id IS NULL
     AND service_date BETWEEN $start AND $end
   GROUP BY charge_type

6. Apply minimum fee logic:
   total_operations_charges := SUM of all non-minimum-fee rows
   effective_min := COALESCE(cbp.custom_minimum_monthly_fee, bp.minimum_monthly_fee)
   IF total_operations_charges < effective_min AND effective_min > 0:
       INSERT INTO billing_transactions (charge_type='minimum_fee', amount=effective_min-total, ...)

7. INSERT INTO invoices (company_id, billing_period_start, billing_period_end, status='draft', ...)
   → trigger assigns invoice_number

8. INSERT INTO invoice_lines for each aggregated charge_type row

9. CALL fn_recompute_invoice_totals($invoiceId)

10. UPDATE billing_transactions SET invoice_id = $invoiceId
    WHERE id = ANY($tx_ids)

11. COMMIT

RESPONSE 201: { invoiceId, invoiceNumber, total, lineCount }
```

---

### 4.5 Invoice Posting Flow

```
1. HTTP POST /invoices/:invoiceId/post
   Role: finance or super_admin

2. BEGIN TRANSACTION

3. SELECT invoice WHERE id=$id AND status='draft' FOR UPDATE
   → Not found or wrong status: ROLLBACK → 409 INVOICE_NOT_DRAFT

4. CALL fn_recompute_invoice_totals($invoiceId)   -- recompute from lines before locking in

5. UPDATE invoices
   SET status      = 'posted',
       issued_date = CURRENT_DATE,
       due_date    = CURRENT_DATE + company.payment_terms_days,
       posted_at   = NOW()
   WHERE id = $invoiceId

6. COMMIT
   -- Invoice is now immutable: any UPDATE trigger on invoices should block status changes
   -- except via designated endpoints

7. AFTER COMMIT:
   EventBus.emit('invoice.posted', { invoiceId, companyId, total, dueDate })
   → NotificationModule: in-app notification to CLIENT_ADMIN
```

---

### 4.6 Stock Adjustment Flow

```
1. HTTP POST /adjustments (creates draft)
2. Add lines with quantity_before (must match current stock — validated at approval)
3. HTTP POST /adjustments/:id/approve (wh_manager role required)

APPROVAL TRANSACTION:
4. BEGIN TRANSACTION
5. fn_validate_adjustment_qty fires via trigger:
   For each line: verify quantity_before == current_stock.quantity_on_hand (±0.001 tolerance)
   → Mismatch: ROLLBACK → 422 QUANTITY_MISMATCH

6. FOR EACH adjustment line:
   IF quantity_change > 0:
     → UPSERT current_stock (positive movement pattern)
   ELSE IF quantity_change < 0:
     → UPDATE current_stock (negative movement pattern, with qty_available check)
   INSERT INTO inventory_ledger (movement_type='adjustment_positive' or 'adjustment_negative')

7. UPDATE stock_adjustments SET status='approved', approved_by=$userId, approved_at=NOW()

8. COMMIT
```

---

## 5. API Design

### Base URL: `/api/v1`
### Auth: `Authorization: Bearer <jwt>`
### All responses: `{ success, data, meta?, error? }`

### 5.1 Auth

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/staff/login` | Returns accessToken (8h), refreshToken (7d) |
| POST | `/auth/client/login` | Returns accessToken (24h) for client users |
| POST | `/auth/refresh` | Exchange refreshToken for new pair |
| POST | `/auth/logout` | Increment token_version → invalidates all sessions |
| GET  | `/auth/me` | Current user profile |
| POST | `/auth/forgot-password` | Send reset email (BullMQ job) |
| POST | `/auth/reset-password` | Validate token (Redis key, 1h TTL), update hash, increment token_version |

---

### 5.2 Inventory

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/inventory/stock` | Current stock with filters: company_id, product_id, location_id, lot_id, warehouse_id, status, expiring_within_days |
| GET | `/inventory/stock/by-product/:productId` | Aggregated stock across all locations |
| GET | `/inventory/ledger` | Movement history — routed to read replica |
| GET | `/inventory/ledger/export` | Async CSV export (returns report_job_id) |

---

### 5.3 Inbound Orders

| Method | Endpoint | Body / Notes |
|--------|----------|-------------|
| GET | `/inbound-orders` | status, date_from, date_to, company_id |
| POST | `/inbound-orders` | `{ companyId, expectedArrivalDate, lines: [{ productId, expectedQuantity, expectedLotNumber?, expectedExpiryDate? }] }` |
| PATCH | `/inbound-orders/:id` | Draft-only mutations |
| POST | `/inbound-orders/:id/confirm` | Creates RECEIVING task; emits event |
| POST | `/inbound-orders/:id/receive` | **Idempotent**. `{ taskId, lineId, scannedProductBarcode, lotNumber?, expiryDate?, quantity, destinationLocationId }` |
| POST | `/inbound-orders/:id/complete` | Manager accepts (partial) order completion |
| POST | `/inbound-orders/:id/cancel` | Only if task is PENDING (not started) |

**Receive — Validation rules:**
- `Idempotency-Key` header required (UUID)
- `taskId` must be IN_PROGRESS and assigned to current user
- `scannedProductBarcode` must resolve to a product on this order
- `quantity` must be > 0
- `destinationLocationId.type` must be in: `input`, `internal`, `qc`
- `received_quantity + quantity` must not exceed `expected_quantity × 1.10`
- Lot required if product.trackingType = 'lot'
- Expiry required if product.expiryTracking = true

**Error codes:**
```
400 UNKNOWN_BARCODE        - scanned value not in system
400 PRODUCT_NOT_ON_ORDER   - resolved product not on this order
400 INVALID_LOCATION_TYPE  - destination location type invalid
400 QUANTITY_EXCEEDS_LIMIT - over 110% of expected
400 LOT_REQUIRED           - lot-tracked product scanned without lot
409 TASK_NOT_IN_PROGRESS   - task must be in_progress
409 IDEMPOTENT_REPLAY      - repeated key, returns original response
422 ORDER_NOT_CONFIRMED    - order must be confirmed before receiving
```

---

### 5.4 Outbound Orders

| Method | Endpoint | Notes |
|--------|----------|-------|
| GET | `/outbound-orders` | |
| POST | `/outbound-orders` | Creates draft; runs stock availability check; creates allocations if sufficient; status = `pending_stock` if not |
| POST | `/outbound-orders/:id/confirm` | Re-validates stock; creates PICKING task; generates sorted pick list |
| GET | `/outbound-orders/:id/pick-list` | Returns allocations sorted by `sort_order` |
| POST | `/outbound-orders/:id/pick` | **Idempotent**. `{ taskId, allocationId, scannedLocationBarcode, scannedProductBarcode, scannedLotBarcode?, quantityPicked }` |
| POST | `/outbound-orders/:id/complete-packing` | Sets status = `ready_to_ship` |
| POST | `/outbound-orders/:id/ship` | `{ carrier, trackingNumber, taskId }` |
| POST | `/outbound-orders/:id/cancel` | Releases all active reservations |

---

### 5.5 Tasks

| Method | Endpoint | Notes |
|--------|----------|-------|
| GET | `/tasks` | Filterable by status, type, warehouse, assigned_to |
| GET | `/tasks/worker-load` | Returns v_worker_load view data |
| POST | `/tasks/:id/assign` | `{ workerId }` — validates worker_role matches task_type |
| POST | `/tasks/auto-assign` | Runs hybrid assignment on all PENDING tasks |
| POST | `/tasks/:id/start` | Sets IN_PROGRESS; returns reference data for UI |
| POST | `/tasks/:id/complete` | Validates required steps logged |
| POST | `/tasks/:id/block` | `{ reason }` — alerts manager |
| POST | `/tasks/:id/unblock` | Resets to IN_PROGRESS |

---

### 5.6 Barcode

| Method | Endpoint | Notes |
|--------|----------|-------|
| POST | `/barcode/scan` | `{ barcodeValue, taskId, expectedEntityType? }` → resolves entity, validates context |
| GET | `/barcode/:entityType/:entityId` | Returns or generates primary barcode |
| POST | `/barcode/print` | `{ items: [{ entityType, entityId, copies }], labelSize }` → async PDF job |

---

### 5.7 Billing

| Method | Endpoint | Notes |
|--------|----------|-------|
| GET | `/billing/plans` | |
| POST | `/billing/plans` | |
| PATCH | `/billing/plans/:id` | |
| GET | `/billing/company-plans` | All client plan assignments |
| POST | `/billing/company-plans` | Assign plan to company; deactivates previous active plan |
| GET | `/billing/transactions` | Filterable; uninvoiced filter: `?invoiced=false` |
| POST | `/billing/generate-invoice` | `{ companyId, billingPeriodStart, billingPeriodEnd }` |

---

### 5.8 Invoicing

| Method | Endpoint | Notes |
|--------|----------|-------|
| GET | `/invoices` | |
| GET | `/invoices/:id` | With lines + payments |
| POST | `/invoices/:id/post` | Recomputes totals, locks invoice |
| POST | `/invoices/:id/send` | Enqueues email job with PDF |
| POST | `/invoices/:id/payment` | Records payment; transitions status |
| POST | `/invoices/:id/credit-note` | Creates linked negative invoice |
| GET | `/invoices/:id/pdf` | Streams PDF from S3/generated |

---

## 6. State Machines

### 6.1 Inbound Order

```
STATES: draft | confirmed | in_progress | partially_received | completed | cancelled

TRANSITIONS (guard → side effect):
  draft         → confirmed          API call, ≥1 lines → create RECEIVING task
  confirmed     → in_progress        RECEIVING task set to in_progress (auto)
  in_progress   → partially_received Some lines received, not all
  in_progress   → completed          All lines received OR manager accepts partial → create PUTAWAY task + billing tx
  partially_received → completed     Manager accepts → PUTAWAY task + billing tx
  draft/confirmed → cancelled        RECEIVING task must be PENDING (not started) → no task created

INVALID (raise 409):
  completed → any
  cancelled → any
  draft → completed (must pass through confirmed + in_progress)
```

### 6.2 Outbound Order

```
STATES: draft | pending_stock | confirmed | picking | packing | ready_to_ship | shipped | cancelled

TRANSITIONS:
  draft           → pending_stock   Confirm with insufficient stock → no allocations
  draft           → confirmed       Confirm with sufficient stock → allocations + reservations + PICKING task
  pending_stock   → confirmed       Stock becomes available (check on new inbound.completed event)
  confirmed       → picking         PICKING task → in_progress (auto)
  picking         → packing         PICKING task completed → create PACKING task (auto)
  packing         → ready_to_ship   Packing complete API call
  ready_to_ship   → shipped         POST /ship (requires tracking number) → deduct stock, billing tx
  draft/pending_stock/confirmed → cancelled → release all active reservations

INVALID:
  shipped → any
  cancelled → any
  picking/packing/ready_to_ship → cancelled (must void via manager override)
```

### 6.3 Task

```
STATES: pending | assigned | in_progress | completed | blocked | cancelled

TRANSITIONS:
  pending     → assigned     POST /assign (worker has required worker_role)
  pending     → cancelled    Parent order cancelled
  assigned    → in_progress  POST /start
  assigned    → pending      POST /unassign (manager)
  in_progress → completed    POST /complete (all required steps logged)
  in_progress → blocked      POST /block (alerts manager)
  blocked     → in_progress  POST /unblock
  blocked     → cancelled    POST /cancel-blocked

INVALID:
  completed → any
  cancelled → any
  pending → completed (must pass through assigned + in_progress)
```

### 6.4 Invoice

```
STATES: draft | posted | sent | paid | partial | overdue | void

TRANSITIONS:
  draft   → posted   POST /post (recomputes totals, immutable after this)
  posted  → sent     POST /send (email queued)
  sent    → paid     POST /payment (amount >= outstanding)
  sent    → partial  POST /payment (amount < outstanding)
  partial → paid     POST /payment (cumulative >= total)
  sent/partial/overdue → overdue   Nightly job: due_date < today
  overdue → paid     POST /payment
  draft   → void     DELETE draft (unlinks billing_transactions)

INVALID:
  posted → draft (immutable)
  paid → any
  void → any
```

### 6.5 QC Alert

```
STATES: open | in_progress | resolved

TRANSITIONS:
  open        → in_progress  Manager opens for investigation
  in_progress → resolved     POST /resolve (accept | return | scrap)
    accept: move stock quarantine → storage location
    return: create return_order
    scrap:  move stock → scrap location; inventory ledger entry

INVALID:
  resolved → any
  open → resolved (must pass through in_progress)
```

---

## 7. Event-Driven Design

All events are emitted via `EventBusService` which wraps EventEmitter2. The interface is extraction-ready: swapping to Kafka/RabbitMQ requires only changing the `EventBusService` implementation.

**Rule:** Events are emitted AFTER the originating DB transaction commits. Never inside a transaction.

| Event | Producer | Consumers | Key Payload |
|-------|----------|-----------|-------------|
| `inbound.order.confirmed` | InboundService | TaskService (create RECEIVING task), NotificationService | orderId, companyId, warehouseId |
| `inbound.order.completed` | InboundService | BillingService (INBOUND_HANDLING tx), NotificationService | orderId, companyId, linesReceived, totalQty |
| `outbound.order.shipped` | OutboundService | BillingService (OUTBOUND tx), NotificationService | orderId, companyId, trackingNumber |
| `task.completed` | TaskService | TaskService (create next task in chain), BillingService (VAS tasks) | taskId, taskType, referenceId, companyId, durationSeconds |
| `qc.check.failed` | QcService | InventoryService (quarantine move), NotificationService | checkId, companyId, productId, lotId, qty |
| `invoice.posted` | InvoicingService | NotificationService | invoiceId, companyId, total, dueDate |
| `invoice.overdue` | OverdueInvoicesJob | NotificationService, OutboundService (optionally block new shipments) | invoiceId, companyId, daysOverdue |
| `stock.threshold.breached` | LowStockCheckJob | NotificationService | companyId, productId, sku, currentQty, threshold |

---

## 8. Security & Multi-Tenancy

### 8.1 JWT Design

```typescript
// Staff token (8h access / 7d refresh)
{
  sub: "user-uuid",
  role: "wh_manager",
  workerRoles: ["picker"],
  companyId: null,
  tokenVersion: 3,
  type: "access"
}

// Client token (24h access / 30d refresh)
{
  sub: "user-uuid",
  role: "client_admin",
  workerRoles: [],
  companyId: "company-uuid",
  tokenVersion: 1,
  type: "access"
}
```

### 8.2 Token Invalidation

```typescript
// On deactivation or password change:
await db.users.update({ where: { id }, data: { tokenVersion: { increment: 1 } } });
await redis.del(`token_version:${id}`);

// On each request (JwtAuthGuard):
const cachedVersion = await redis.get(`token_version:${userId}`);
const actualVersion = cachedVersion ?? (await db.users.findUnique({ where: { id: userId } })).tokenVersion;
if (jwt.tokenVersion !== actualVersion) throw new UnauthorizedException();
// Cache: SET token_version:{userId} {version} EX 28800
```

### 8.3 Multi-Tenancy Layers

```
Layer 1: CompanyGuard (NestJS)
  Client roles: override request.body.companyId = jwt.companyId (non-overridable)
  Log warning if client provides different companyId in body

Layer 2: RlsMiddleware (Prisma $use middleware)
  Before every request:
    await prisma.$executeRaw`SELECT fn_set_app_context(${userId}, ${companyId}, ${role})`
  This sets session-local GUC variables consumed by RLS policies

Layer 3: PostgreSQL RLS (fn_set_app_context / FORCE ROW LEVEL SECURITY)
  PERMISSIVE internal_access: internal roles see all rows
  PERMISSIVE client_access: clients see own company rows
  RESTRICTIVE client_boundary: hard ceiling — client roles ALWAYS filtered to company_id
  → Even if application layer bug sends wrong companyId, DB enforces isolation

Layer 4: Column-level guards (application)
  Users cannot read: password_hash, token_version of other users
  Clients cannot see: other companies' billing_plans details
```

### 8.4 Role Permissions

```typescript
const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  super_admin:   ['*'],  // all permissions
  wh_manager:    ['inventory:*', 'orders:*', 'tasks:*', 'qc:*', 'adjustments:approve', 'reports:read', 'billing:read'],
  wh_operator:   ['tasks:execute', 'inventory:read:own_tasks', 'barcode:scan'],
  finance:       ['billing:*', 'invoices:*', 'payments:*', 'reports:read'],
  client_admin:  ['orders:create', 'orders:read:own', 'inventory:read:own', 'invoices:read:own', 'returns:create'],
  client_staff:  ['orders:create', 'orders:read:own', 'inventory:read:own'],
};
```

### 8.5 Rate Limiting (Nginx)

```nginx
# Per-IP rate limits
limit_req_zone $binary_remote_addr zone=general:10m  rate=100r/m;
limit_req_zone $binary_remote_addr zone=login:10m    rate=5r/m;
limit_req_zone $http_authorization zone=scan:10m     rate=600r/m;  # 10/sec per user

location /api/v1/auth/login    { limit_req zone=login   burst=2 nodelay; }
location /api/barcode/scan     { limit_req zone=scan    burst=20 nodelay; }
location /api/v1/              { limit_req zone=general burst=30 nodelay; }
```

---

## 9. Observability & Monitoring

### 9.1 Structured Logging (nestjs-pino)

```typescript
// Every log entry includes:
{
  timestamp: "ISO8601",
  level: "info|warn|error",
  requestId: "uuid",  // correlation ID from X-Request-Id header
  userId: "uuid",
  companyId: "uuid|null",
  role: "wh_manager",
  method: "POST",
  url: "/api/v1/inbound-orders/xxx/receive",
  statusCode: 200,
  responseTimeMs: 45,
  // For errors:
  errorCode: "INSUFFICIENT_STOCK",
  errorStack: "...",
}
```

### 9.2 Prometheus Metrics (prom-client)

```
# Application metrics
wms_scan_operations_total{type="receive"|"pick", status="success"|"error"} counter
wms_scan_duration_ms{type}                                                  histogram (p50, p95, p99)
wms_active_tasks_total{type, warehouse_id}                                  gauge
wms_stock_movements_total{movement_type}                                    counter
wms_billing_transactions_total{charge_type}                                 counter
wms_invoice_total_amount{company_id}                                        counter

# Business KPI metrics
wms_inbound_orders_created_total{company_id}                                counter
wms_outbound_orders_shipped_total{company_id}                               counter
wms_qc_alerts_open_total                                                    gauge

# DB metrics (from pg_stat_user_tables via postgres_exporter)
pg_stat_user_tables_n_live_tup{relname}
pg_stat_activity_count{state}
pg_locks_count{mode}
```

### 9.3 Alerting Rules

```yaml
# Grafana alert conditions
- name: HighScanErrorRate
  condition: rate(wms_scan_operations_total{status="error"}[5m]) / rate(wms_scan_operations_total[5m]) > 0.05
  severity: critical

- name: SlowScanP99
  condition: histogram_quantile(0.99, rate(wms_scan_duration_ms_bucket[5m])) > 500
  severity: warning

- name: DBConnectionPoolSaturated
  condition: pg_stat_activity_count{state="active"} > 80
  severity: critical

- name: PartitionMissing
  condition: absent(pg_tables{tablename=~"inventory_ledger_.*"})
  severity: critical   # partition creation job failed

- name: OverdueInvoicesHigh
  condition: count(v_overdue_invoices) > 5
  severity: warning
```

### 9.4 Health Check

```
GET /health
Response 200:
{
  "status": "ok",
  "db": "connected",
  "replica": "connected",
  "redis": "connected",
  "queues": {
    "email": { "waiting": 2, "active": 1, "failed": 0 },
    "snapshot": { "nextRun": "2025-04-30T00:00:00Z" }
  },
  "partitions": {
    "inventory_ledger": { "currentMonth": "2025_04", "exists": true, "nextMonth": "2025_05", "exists": true },
    "billing_transactions": { "currentMonth": "2025_04", "exists": true }
  }
}
```

### 9.5 Tracing (OpenTelemetry)

```typescript
// Instrument NestJS with @opentelemetry/auto-instrumentations-node
// Traces include: HTTP span → NestJS handler span → Prisma query span → DB round-trip
// Export to: Jaeger (self-hosted) or Tempo (Grafana Cloud)
// Sample rate: 10% in production, 100% for error traces
```

---

## 10. Implementation Plan

### Phase 0: Infrastructure Foundation (Week 1)
**Objective:** Dev environment running, CI pipeline green, observability in place before first feature line.

**Deliverables:**
- Docker Compose: PostgreSQL 16 + Redis 7 + PgBouncer + Prometheus + Grafana
- NestJS project scaffold: modules, guards, interceptors, global exception filter
- Prisma client configured with `$use` middleware for RLS context
- Health check endpoint (`/health`)
- Sentry SDK integrated (captures all unhandled exceptions)
- BullMQ base configuration (email queue + cron jobs)
- GitHub Actions CI: lint → test → prisma migrate → build
- `final_schema.sql` applied as migration 001

**No business logic. No APIs. Only infrastructure.**

---

### Phase 1: Auth + Registration (Week 2)
**DB:** `companies`, `users`, `user_worker_roles`, `sequence_counters`  
**APIs:** Login (staff + client), refresh, logout, me, forgot-password, reset-password  
**APIs:** Registration Portal: CRUD for admin users, companies, client users  
**Features:**
- JWT issuance with `tokenVersion`
- Token invalidation (increment `token_version`, purge Redis cache)
- RLS context set on every request
- CompanyGuard active

---

### Phase 2: Inventory Core (Weeks 3–4)
**DB:** `warehouses`, `locations`, `product_categories`, `products`, `lots`, `packages`, `putaway_rules`, `current_stock`, `barcodes`  
**APIs:** Full CRUD for all above tables  
**APIs:** `GET /inventory/stock`, `GET /inventory/ledger`  
**Features:**
- Barcode generation for locations and products
- Atomic UPSERT pattern for `current_stock`
- Trigram search on products
- Label print endpoint (sync PDF for small jobs)

---

### Phase 3: Inbound Orders (Weeks 5–6)
**DB:** `inbound_orders`, `inbound_order_lines`, `inbound_order_line_lots`, `idempotency_keys`  
**APIs:** Full inbound lifecycle + `/receive` endpoint  
**Features:**
- Complete inbound flow (§4.1)
- Idempotency interceptor (Redis + DB fallback)
- Over-receive guard (trigger)
- QC rule evaluation at receive time
- `inbound.order.confirmed` + `inbound.order.completed` events

---

### Phase 4: Outbound Orders (Weeks 7–8)
**DB:** `outbound_orders`, `outbound_order_lines`, `outbound_allocations`, `stock_reservations`  
**APIs:** Full outbound lifecycle + `/pick` + `/ship`  
**Features:**
- FEFO/FIFO allocation engine (uses `idx_lots_fefo`)
- Pick list generation (sorted by `sort_order`)
- Reservation creation + sync trigger
- Optimistic locking on pick
- `outbound.order.shipped` event

---

### Phase 5: Tasks + Barcode UI (Weeks 9–11)
**DB:** `tasks`, `task_step_logs`  
**APIs:** Full task lifecycle  
**Features:**
- Task chain: RECEIVING → PUTAWAY → PICKING → PACKING → SHIPPING
- Hybrid auto-assignment (v_worker_load score)
- React PWA barcode UI:
  - Service worker (Workbox) for offline mode
  - IndexedDB queue for offline scans
  - Sync processor on reconnect
  - All 4 operation flows: Receive, Putaway, Pick, Pack
- Audio + visual scan feedback

---

### Phase 6: QC (Week 12)
**DB:** `qc_rules`, `qc_checks`, `qc_alerts`  
**APIs:** Rules CRUD, check complete, alert resolve  
**Features:**
- Rule evaluation at receive time (triggers QC task creation)
- Company-scoped rules
- Photo upload to S3 (`POST /uploads/qc-photo → signed URL`)
- Stock quarantine on QC fail
- `qc.check.failed` event
- Alert resolution (accept/return/scrap) with correct inventory movements

---

### Phase 7: Billing (Weeks 13–14)
**DB:** `billing_plans`, `billing_plan_vas_rates`, `client_billing_plans`, `billing_transactions`  
**APIs:** Plan CRUD, plan assignment, transactions, generate-invoice  
**Features:**
- Event listeners: create billing transactions on inbound.completed, outbound.shipped
- Daily storage snapshot cron job (BullMQ):
  - At midnight: calculate pallet-days for each company's active stock
  - Insert one `billing_transactions` row per company per charge type
- Invoice generation flow (§4.4)
- Minimum fee application
- `rate_snapshot` populated from effective rates at time of billing

---

### Phase 8: Invoicing + Payments (Week 15)
**DB:** `invoices`, `invoice_lines`, `payments`, `report_jobs`  
**APIs:** Full invoice lifecycle  
**Features:**
- Post/send/payment/credit-note flows
- PDF generation (BullMQ job → `report_jobs` table)
- Email dispatch (BullMQ queue with retries)
- Overdue detection cron (hourly)
- Payment recording + status transitions

---

### Phase 9: Hardening, Testing & Performance (Weeks 16–17)
**Deliverables:**
- All missing indexes verified against EXPLAIN ANALYZE on production-sized dataset
- `fn_create_next_partitions` scheduled via BullMQ monthly cron
- Load test (k6): 1000 concurrent barcode scans/min for 30 minutes
  - Target: p99 < 200ms for scan resolution, p99 < 500ms for stock writes
  - Measure: DB CPU, connection pool saturation, Redis hit rate
- Security review:
  - Test RLS bypass: connect as `wms_app`, set wrong company_id, verify 0 rows returned
  - Test idempotency: replay same Idempotency-Key, verify no duplicate ledger entry
  - Test token invalidation: deactivate user mid-session, verify 401 on next request
- Return orders module (if not completed in Phase 4)
- Cycle count workflow
- Client Portal (Phase 10 if in scope)

---

## 11. Load Testing Plan

### Tools: k6 (scenarios) + Grafana (results)

### Scenario 1: Barcode Scan Throughput
```javascript
// k6 script
export const options = {
  scenarios: {
    scan_load: {
      executor: 'constant-arrival-rate',
      rate: 1000,       // 1000 scans/min
      timeUnit: '1m',
      duration: '30m',
      preAllocatedVUs: 50,
      maxVUs: 100,
    }
  },
  thresholds: {
    'http_req_duration{endpoint:scan}': ['p(99)<500'],
    'http_req_failed{endpoint:scan}': ['rate<0.01'],
  }
};

export default function() {
  const res = http.post(`${BASE_URL}/api/barcode/scan`,
    JSON.stringify({ barcodeValue: randomBarcode(), taskId: getActiveTask() }),
    { headers: { 'Idempotency-Key': uuidv4(), 'Authorization': workerToken } }
  );
  check(res, { 'status 200': (r) => r.status === 200 });
}
```

### Scenario 2: Concurrent Picks (Hotspot Location)
```javascript
// 20 workers all picking from same location simultaneously
// Verify: no negative stock, no 500 errors, all retries succeed within 3 attempts
```

### Scenario 3: Invoice Generation (100 companies, end of month)
```javascript
// Generate invoices for 100 companies simultaneously
// Target: all complete within 60 seconds
// Verify: no double-invoicing, no missing transactions
```

### Success Criteria

| Metric | Target |
|--------|--------|
| Scan resolution p99 | < 200ms |
| Stock write p99 | < 500ms |
| Invoice generation (per company) | < 3s |
| Error rate under load | < 0.5% |
| DB connection pool utilisation | < 80% |
| Redis hit rate (barcode cache) | > 90% |
| No negative stock rows | 0 violations |
| No duplicate ledger entries | 0 duplicates |

---

## 12. Production Runbook

### Day-1 Checklist

```
Database:
□ fn_create_next_partitions(6) — create 6 months of partitions
□ fn_create_next_audit_partitions(4) — create 4 quarters of audit partitions
□ ANALYZE on all tables after initial data load
□ pg_stat_statements enabled (for slow query monitoring)
□ pg_partman optional — consider if partition management becomes complex

Application:
□ wms_app role created; does NOT own tables
□ FORCE ROW LEVEL SECURITY confirmed on all tenant tables
□ Sentry DSN configured
□ Redis maxmemory-policy = volatile-lru (or separate instances)
□ BullMQ cron jobs registered and firing on schedule
□ Health check responding to load balancer

Monitoring:
□ Grafana dashboards imported
□ Alert rules configured (§9.3)
□ PagerDuty / on-call rotation configured for critical alerts
□ Log aggregation (CloudWatch / Datadog) receiving structured logs
```

### Key Maintenance Jobs (BullMQ Cron)

| Job | Schedule | Purpose |
|-----|----------|---------|
| `storage-snapshot` | `0 0 * * *` (midnight) | Create daily pallet-day billing transactions |
| `overdue-invoices` | `0 6 * * *` (6am) | Mark overdue, emit events |
| `low-stock-check` | `0 7 * * *` (7am) | Alert clients on threshold breach |
| `partition-create` | `0 1 1 * *` (1st of month) | Create next 3 months of partitions |
| `idempotency-cleanup` | `0 3 * * *` (3am) | Delete expired keys |
| `notification-cleanup` | `0 4 * * *` (4am) | Prune old read notifications |

### Incident Response

**"No partition found" error on inventory_ledger / billing_transactions:**
```sql
SELECT fn_create_next_partitions(3);
SELECT fn_create_next_audit_partitions(2);
-- Verify:
SELECT tablename FROM pg_tables WHERE tablename LIKE 'inventory_ledger_%' ORDER BY tablename DESC LIMIT 5;
```

**Suspected cross-tenant data leak:**
```sql
-- Check: does any company_id appear in another company's orders?
SELECT io.company_id, io.order_number, p.company_id AS product_company_id
FROM inbound_orders io
JOIN inbound_order_lines iol ON iol.inbound_order_id = io.id
JOIN products p ON p.id = iol.product_id
WHERE io.company_id <> p.company_id;
-- Should return 0 rows.

-- Verify RLS is active:
SELECT relname, rowsecurity, forcerowsecurity FROM pg_class WHERE relname IN ('products','current_stock','inbound_orders');
-- forcerowsecurity must be TRUE for all.
```

**Negative stock detected:**
```sql
SELECT * FROM current_stock WHERE quantity_on_hand < 0;
-- Should return 0 rows. If not: investigate which transaction bypassed the guard.
-- Check: audit_logs WHERE action LIKE '%stock%' AND created_at > (incident time - 1h)
```

**Duplicate idempotency key not deduplicating:**
```sql
-- Check Redis hit rate:
redis-cli info stats | grep keyspace_hits
-- Check DB idempotency_keys:
SELECT key, user_id, endpoint, response_status, created_at
FROM idempotency_keys
WHERE key = $suspect_key;
-- If response_body is NULL: first request is still in-flight or failed without update
```

---

*End of Engineering Blueprint v2.0*
