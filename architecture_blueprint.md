# EMDAD 3PL WMS — Architecture Blueprint v2
**PostgreSQL 16 · Modular Monolith · OLTP + OLAP**

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [OLTP vs OLAP Separation](#2-oltp-vs-olap-separation)
3. [Star Schema Design](#3-star-schema-design)
4. [Fact Tables Reference](#4-fact-tables-reference)
5. [Dimension Tables Reference](#5-dimension-tables-reference)
6. [Data Flow — ETL/ELT Pipeline](#6-data-flow--etlelt-pipeline)
7. [Critical Issue Resolutions](#7-critical-issue-resolutions)
8. [Scaling Strategy](#8-scaling-strategy)
9. [Trade-offs](#9-trade-offs)

---

## 1. Architecture Overview

### 1.1 System Topology

```
┌─────────────────────────────────────────────────────────────────────┐
│  CLIENT TIER                                                         │
│  ┌────────────────┐  ┌────────────────┐  ┌──────────────────────┐  │
│  │ Admin Dashboard│  │ Client Portal  │  │ Barcode PWA (mobile) │  │
│  │ (React)        │  │ (React)        │  │ (React, offline SW)  │  │
│  └───────┬────────┘  └───────┬────────┘  └──────────┬───────────┘  │
└──────────┼────────────────────┼─────────────────────┼──────────────┘
           │ HTTPS/REST          │ HTTPS/REST           │ HTTPS/REST
┌──────────▼────────────────────▼─────────────────────▼──────────────┐
│  API GATEWAY (Nginx / AWS ALB)                                       │
│  • TLS termination  • Rate limiting  • Request ID injection          │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────┐
│  APPLICATION TIER — NestJS Modular Monolith                          │
│                                                                      │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐  │
│  │  Auth       │ │  Inventory  │ │  Orders     │ │  Tasks      │  │
│  │  Module     │ │  Module     │ │  Module     │ │  Module     │  │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘  │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐  │
│  │  Billing    │ │  Invoicing  │ │  QC         │ │  Barcode    │  │
│  │  Module     │ │  Module     │ │  Module     │ │  Module     │  │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘  │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Shared Infrastructure                                        │   │
│  │  Event Bus (in-process)  │  Prisma ORM  │  RLS Middleware    │   │
│  └──────────────────────────────────────────────────────────────┘   │
└────────────┬──────────────────────────────────┬─────────────────────┘
             │                                  │
┌────────────▼────────────────┐   ┌─────────────▼──────────────────────┐
│  Redis                       │   │  BullMQ Workers                     │
│  • Session / JWT validation  │   │  • ETL cron (analytics.etl_run_all) │
│  • Barcode / stock cache     │   │  • Billing generation               │
│  • Idempotency fast-path     │   │  • Partition maintenance            │
│  • BullMQ queue backend      │   │  • Report generation                │
└──────────────────────────────┘   └────────────────────────────────────┘
             │                                  │
┌────────────▼──────────────────────────────────▼──────────────────────┐
│  DATABASE TIER                                                         │
│                                                                        │
│  Primary PostgreSQL 16                    Analytics PostgreSQL 16      │
│  schema: public (OLTP)                    schema: analytics (OLAP)     │
│  • High-write OLTP tables                 • Star schema                │
│  • Partitioned ledger/billing/audit       • Partitioned facts          │
│  • RLS enforced                           • ETL watermarks             │
│                                                                        │
│  Read Replica(s)                                                       │
│  • Serves reporting queries from OLTP     • Serves BI tools            │
│  • Serves low-latency list endpoints                                   │
└────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Architecture Style

**Modular Monolith** — single deployable unit with strict module boundaries.

Justification:
- Warehouse operations require **strong transactional consistency** across modules (e.g., stock reservation + task creation + billing transaction in one DB transaction).
- Microservices would introduce distributed transaction complexity (2PC, sagas) with no benefit at this scale.
- Modules are designed as **bounded contexts**: each owns its tables, services, and events. Future extraction to microservices is straightforward when scale demands it.

### 1.3 Key Design Principles

| Principle | Implementation |
|---|---|
| **Append-only audit trail** | `inventory_ledger`, `billing_transactions`, `audit_logs` have immutability triggers |
| **Single source of truth** | `current_stock` is the authoritative position; ledger is history |
| **Idempotency everywhere** | Redis fast-path + DB `idempotency_keys` table + ledger dedup table |
| **Context isolation** | RLS via `set_config(..., is_local=TRUE)` inside explicit transactions |
| **Consistent locking order** | `fn_lock_stock_rows_ordered()` prevents deadlocks |
| **Financial precision** | DECIMAL(10,4) rates, DECIMAL(14,2) amounts, ROUND(qty×price, 2) always |
| **Partition resilience** | DEFAULT partitions catch overflows; auto-create runs 3 months ahead |

---

## 2. OLTP vs OLAP Separation

### 2.1 Schema Separation

```
PostgreSQL Instance
├── schema: public          (OLTP — transactional, high-concurrency)
│   ├── companies, users, warehouses, locations
│   ├── products, lots, packages
│   ├── current_stock         ← real-time stock position
│   ├── inventory_ledger      ← append-only movement history (partitioned)
│   ├── inbound_orders, outbound_orders, return_orders
│   ├── stock_reservations    ← drives current_stock.quantity_reserved
│   ├── outbound_allocations  ← drives picking
│   ├── tasks, task_step_logs
│   ├── qc_rules, qc_checks, qc_alerts
│   ├── billing_transactions  ← append-only (partitioned)
│   ├── invoices, invoice_lines, payments
│   └── audit_logs            ← append-only (partitioned)
│
└── schema: analytics       (OLAP — read-optimized, star schema)
    ├── dim_date, dim_company, dim_product, dim_category
    ├── dim_location, dim_warehouse, dim_user, dim_lot
    ├── dim_task_type, dim_order
    ├── fact_inventory_movements  (partitioned)
    ├── fact_stock_snapshot       (partitioned)
    ├── fact_inbound_operations
    ├── fact_outbound_operations
    ├── fact_billing_transactions (partitioned)
    ├── fact_tasks                (partitioned)
    └── etl_watermarks
```

### 2.2 Access Control by Schema

| Role | `public` schema | `analytics` schema |
|---|---|---|
| `wms_app` | SELECT, INSERT, UPDATE, DELETE | No access |
| `wms_analytics` | No access | SELECT only |
| `wms_etl` | SELECT only | SELECT, INSERT, UPDATE, DELETE |

### 2.3 When to Query Which Schema

| Use Case | Query Target |
|---|---|
| Barcode scan (worker action) | `public.current_stock`, `public.inventory_ledger` |
| Reserve stock for outbound | `public.stock_reservations` (via trigger) |
| Real-time stock check | `public.v_stock_summary` (OLTP view) |
| Monthly revenue report | `analytics.v_revenue_by_company_month` |
| Inventory trend chart | `analytics.v_stock_trend` |
| Worker productivity KPI | `analytics.v_worker_productivity` |
| Historical stock level | `analytics.fact_stock_snapshot` |

---

## 3. Star Schema Design

### 3.1 Model Overview

```
                           dim_date
                              │
          dim_lot ──────────┐ │ ┌─── dim_location (from/to)
                            ▼ ▼ ▼
dim_company ──────── fact_inventory_movements ──── dim_product
                            │
                         dim_user
                         dim_order

dim_date ──── fact_stock_snapshot ──── dim_company
                     │                     │
              dim_product            dim_warehouse
              dim_location
              dim_lot

dim_date ──── fact_billing_transactions ──── dim_company
                     │
                  dim_order

dim_date ──── fact_tasks ──── dim_company
                 │                │
           dim_user         dim_warehouse
           dim_task_type
```

### 3.2 SCD Strategy

| Dimension | SCD Type | Rationale |
|---|---|---|
| `dim_company` | Type 2 | Track name/status/billing_cycle changes for historical billing attribution |
| `dim_product` | Type 2 | Track SKU renames, status changes — billing must reference correct product version |
| `dim_location` | Type 2 | Track type/path renames — movement history must show location as it was |
| `dim_user` | Type 2 | Track role changes — productivity reports reflect correct role at time of task |
| `dim_lot` | Type 1 | Expiry date is a factual attribute; overwrite is correct |
| `dim_warehouse` | Type 1 | Warehouse attributes rarely change; overwrite acceptable |
| `dim_category` | Type 1 | Category renames apply retroactively by design |
| `dim_task_type` | Static | Derived from ENUM; never changes |
| `dim_order` | Degenerate | Order number stored directly on fact; minimal additional attributes needed |
| `dim_date` | Static | Pre-populated spine; dates are immutable |

### 3.3 Surrogate Key Strategy

All dimension surrogate keys use `BIGINT GENERATED ALWAYS AS IDENTITY` — PostgreSQL's internal sequence. This is preferred over UUIDs for:
- Smaller index footprint on fact tables (8 bytes vs 16 bytes per FK)
- Better join performance on analytical queries
- Deterministic ordering for partition pruning

Natural keys (UUIDs from OLTP) are kept as separate columns for data lineage and ETL merge operations.

---

## 4. Fact Tables Reference

### 4.1 `fact_inventory_movements`

| Column | Type | Description |
|---|---|---|
| `movement_key` | BIGINT | Surrogate PK |
| `event_date` | DATE | Partition key (mirrors `inventory_ledger.created_at::DATE`) |
| `date_key` | INTEGER | FK → dim_date |
| `company_key` | BIGINT | FK → dim_company (current version at load time) |
| `product_key` | BIGINT | FK → dim_product |
| `lot_key` | BIGINT | FK → dim_lot (nullable) |
| `from_location_key` | BIGINT | FK → dim_location (nullable — inbound has no from) |
| `to_location_key` | BIGINT | FK → dim_location (nullable — outbound has no to) |
| `operator_key` | BIGINT | FK → dim_user |
| `order_key` | BIGINT | FK → dim_order |
| `movement_type` | TEXT | Enum text (inbound_receive, outbound_pick, etc.) |
| `quantity` | DECIMAL(15,4) | Units moved |
| `oltp_ledger_id` | UUID | Traceability back to source row |

**Grain:** One row per `inventory_ledger` entry. Never updated — append-only.

**Partitioned:** By `event_date` (monthly). Mirrors OLTP ledger partitioning.

**Typical Queries:**
```sql
-- Total inbound volume per company per month
SELECT dc.name, dd.year, dd.month_name, SUM(fim.quantity)
FROM   analytics.fact_inventory_movements fim
JOIN   analytics.dim_company dc ON dc.company_key = fim.company_key
JOIN   analytics.dim_date    dd ON dd.date_key    = fim.date_key
WHERE  fim.movement_type = 'inbound_receive'
  AND  dd.year = 2025
GROUP  BY dc.name, dd.year, dd.month_name
ORDER  BY dd.year, MIN(dd.month_number);
```

---

### 4.2 `fact_stock_snapshot`

| Column | Type | Description |
|---|---|---|
| `snapshot_key` | BIGINT | Surrogate PK |
| `snapshot_date` | DATE | Partition key — one snapshot per calendar day |
| `company_key` | BIGINT | FK → dim_company |
| `product_key` | BIGINT | FK → dim_product |
| `warehouse_key` | BIGINT | FK → dim_warehouse |
| `location_key` | BIGINT | FK → dim_location |
| `lot_key` | BIGINT | FK → dim_lot (nullable) |
| `quantity_on_hand` | DECIMAL(15,4) | Position at snapshot time |
| `quantity_reserved` | DECIMAL(15,4) | Reserved for outbound |
| `quantity_available` | DECIMAL(15,4) | Available for new orders |

**Grain:** One row per (company, product, location, lot) per day. Represents end-of-day stock position.

**ETL:** Delete-then-insert pattern (idempotent re-runs). Run daily at 00:00 UTC.

**Key Use:** Stock trend charts, slow-moving inventory reports, storage billing reconciliation.

---

### 4.3 `fact_inbound_operations`

| Column | Type | Description |
|---|---|---|
| `inbound_op_key` | BIGINT | Surrogate PK |
| `confirmed_date_key` | INTEGER | When order was confirmed |
| `completed_date_key` | INTEGER | When order was marked complete |
| `arrival_date_key` | INTEGER | Expected arrival date |
| `total_lines` | INTEGER | Number of inbound lines |
| `total_expected_qty` | DECIMAL | Sum of expected quantities |
| `total_received_qty` | DECIMAL | Sum of actually received |
| `fill_rate_pct` | DECIMAL | Generated: received/expected × 100 |
| `discrepancy_lines` | INTEGER | Lines with any discrepancy |
| `days_to_complete` | DECIMAL | Lead time in days |
| `is_on_time` | BOOLEAN | Completed on or before expected arrival |

**Grain:** One row per inbound order. Upsert-friendly (status and quantities may update before completion).

---

### 4.4 `fact_outbound_operations`

| Column | Type | Description |
|---|---|---|
| `outbound_op_key` | BIGINT | Surrogate PK |
| `order_date_key` | INTEGER | Confirmation date |
| `ship_date_key` | INTEGER | Actual ship date |
| `required_ship_date_key` | INTEGER | Promised ship date |
| `total_requested_qty` | DECIMAL | What client ordered |
| `total_picked_qty` | DECIMAL | What was actually picked |
| `short_pick_lines` | INTEGER | Lines that could not be fully picked |
| `is_on_time` | BOOLEAN | Shipped on or before required date |

**Grain:** One row per outbound order. Upsert-friendly.

---

### 4.5 `fact_billing_transactions`

| Column | Type | Description |
|---|---|---|
| `billing_key` | BIGINT | Surrogate PK |
| `service_date` | DATE | Partition key |
| `company_key` | BIGINT | FK → dim_company |
| `charge_type` | TEXT | storage, inbound_handling, outbound_handling, vas, etc. |
| `quantity` | DECIMAL(15,4) | Billable units |
| `unit_price` | DECIMAL(10,4) | Rate at time of billing |
| `amount` | DECIMAL(14,2) | ROUND(quantity × unit_price, 2) |
| `is_invoiced` | BOOLEAN | TRUE once linked to an invoice |

**Grain:** One row per `billing_transactions` row. Revenue analysis, AR aging, charge-type breakdown.

---

### 4.6 `fact_tasks`

| Column | Type | Description |
|---|---|---|
| `task_fact_key` | BIGINT | Surrogate PK |
| `created_date` | DATE | Partition key |
| `worker_key` | BIGINT | FK → dim_user (assigned worker) |
| `task_type_key` | SMALLINT | FK → dim_task_type |
| `duration_minutes` | DECIMAL | started_at → completed_at in minutes |
| `step_count` | INTEGER | Number of scan steps performed |
| `error_step_count` | INTEGER | Steps with result = 'error' |

**Grain:** One row per completed or cancelled task. Worker productivity KPIs, task throughput.

---

## 5. Dimension Tables Reference

### 5.1 `dim_date` (Static spine)

Pre-populated from 2020-01-01 to 2035-12-31 by `analytics.etl_populate_dim_date()`.
- `date_key` = YYYYMMDD integer — enables date range queries without JOIN:
  ```sql
  WHERE date_key BETWEEN 20250101 AND 20250131
  ```
- Includes `is_holiday` flag — set `TRUE` manually for public holidays for capacity planning.
- Includes `fiscal_year` / `fiscal_quarter` for clients with non-calendar fiscal years.

### 5.2 SCD Type 2 Mechanics

For `dim_company`, `dim_product`, `dim_location`, `dim_user`:

```
ETL merge process:
┌─────────────────────────────────────────────────────────────────┐
│ 1. For each OLTP record:                                         │
│    a. Find current dimension row (WHERE natural_key = X AND     │
│       is_current = TRUE)                                         │
│    b. Compare tracked attributes                                 │
│    c. IF changed:                                                │
│       • UPDATE old row: valid_to = today-1, is_current = FALSE  │
│       • INSERT new row: valid_from = today, valid_to = NULL,    │
│                         is_current = TRUE                        │
│    d. IF no change: skip (no-op)                                 │
│                                                                  │
│ 2. Fact ETL always joins ON (natural_key AND is_current=TRUE)   │
│    to get the surrogate key valid at load time.                  │
└─────────────────────────────────────────────────────────────────┘
```

**Point-in-time query pattern:**
```sql
-- Find what a product's name was on 2025-06-15
SELECT *
FROM   analytics.dim_product
WHERE  product_id = 'some-uuid'
  AND  valid_from <= '2025-06-15'
  AND  (valid_to IS NULL OR valid_to >= '2025-06-15');
```

### 5.3 `dim_task_type` (Static)

Seeded from task_type ENUM. Maps task names to analytical categories:

| task_type_name | task_category |
|---|---|
| receiving | inbound |
| qc_check | quality |
| putaway | storage |
| picking | outbound |
| packing | outbound |
| shipping | outbound |
| counting | admin |
| transfer | storage |

### 5.4 `dim_lot` (SCD Type 1)

- `is_expired` is a **generated column** (`expiry_date < CURRENT_DATE`) — updates automatically without ETL.
- Useful for: identifying expired inventory in snapshots, FEFO compliance tracking.

---

## 6. Data Flow — ETL/ELT Pipeline

### 6.1 Pipeline Architecture

```
OLTP (public schema)              ETL Layer                Analytics (analytics schema)
─────────────────────             ──────────               ──────────────────────────────

inventory_ledger      ──batch──► etl_load_fact_inventory_movements()  ──► fact_inventory_movements
                                 (incremental, watermark-based)

current_stock         ──daily──► etl_load_fact_stock_snapshot()       ──► fact_stock_snapshot
                                 (full snapshot at midnight UTC)

inbound_orders        ──batch──► etl_load_fact_inbound_operations()   ──► fact_inbound_operations
outbound_orders       ──batch──► etl_load_fact_outbound_operations()  ──► fact_outbound_operations
billing_transactions  ──batch──► etl_load_fact_billing_transactions() ──► fact_billing_transactions
tasks                 ──batch──► etl_load_fact_tasks()                ──► fact_tasks

companies             ──nightly► etl_merge_dim_company()              ──► dim_company (SCD2)
products              ──nightly► etl_merge_dim_product()              ──► dim_product (SCD2)
locations             ──nightly► etl_merge_dim_location()             ──► dim_location (SCD2)
users                 ──nightly► etl_merge_dim_user()                 ──► dim_user (SCD2)
warehouses            ──nightly► etl_merge_dim_warehouse()            ──► dim_warehouse (SCD1)
lots                  ──nightly► etl_merge_dim_lot()                  ──► dim_lot (SCD1)
```

### 6.2 ETL Schedule (BullMQ Cron)

| Job | Cron | Function | Notes |
|---|---|---|---|
| Dimension refresh | `0 1 * * *` (1 AM UTC) | All `etl_merge_dim_*()` functions | Runs before fact loads |
| Fact: inventory movements | `*/15 * * * *` (every 15 min) | `etl_load_fact_inventory_movements()` | Near-real-time |
| Fact: billing transactions | `0 2 * * *` (2 AM UTC) | `etl_load_fact_billing_transactions()` | Nightly |
| Fact: inbound/outbound | `0 2 * * *` | Both inbound + outbound functions | Nightly |
| Fact: tasks | `0 3 * * *` | `etl_load_fact_tasks()` | Nightly |
| Daily snapshot | `0 0 * * *` (midnight UTC) | `etl_load_fact_stock_snapshot()` | Previous day's closing position |
| Master runner | `0 3 * * *` | `analytics.etl_run_all()` | Runs all in correct sequence |
| Partition maintenance | `0 4 1 * *` (1st of month) | `fn_create_next_partitions(3)` + `analytics.etl_create_next_fact_partitions(3)` | Creates 3 months ahead |

### 6.3 Incremental Load Strategy

**Watermark pattern:**
```
analytics.etl_watermarks
├── table_name        → 'fact_inventory_movements'
├── last_loaded_at    → '2025-05-10 02:15:00+03'  ← high-water mark
└── rows_loaded       → 48292

ETL query:
WHERE oltp_table.created_at > last_loaded_at

After success:
UPDATE etl_watermarks SET last_loaded_at = NOW()
```

**Idempotency:** Fact load functions use `ON CONFLICT DO NOTHING` (dedup by `oltp_*_id`). Safe to re-run after failure. Snapshot ETL uses delete-then-insert per date — always produces correct result.

### 6.4 ETL Data Lineage

Every fact row carries an `oltp_*_id` column (UUID of the source OLTP row). This enables:
- Direct JOIN back to OLTP for drill-through in BI tools
- Audit trail from analytics insight back to original transaction
- Debugging of ETL discrepancies

### 6.5 Real-time vs Batch Trade-off

| Metric | OLTP | Analytics |
|---|---|---|
| Stock balance (real-time) | `current_stock` (read replica) | Not available |
| Stock balance (last-night) | — | `fact_stock_snapshot` |
| Movement history (15-min lag) | `inventory_ledger` | `fact_inventory_movements` |
| Revenue (last-night) | `billing_transactions` | `fact_billing_transactions` |
| Worker KPI (last-night) | `tasks` + `task_step_logs` | `fact_tasks` |

---

## 7. Critical Issue Resolutions

### Issue 1: Reservation Inconsistency

**Problem:** `current_stock.quantity_reserved` could drift from `SUM(active stock_reservations)` due to direct updates or missed triggers.

**Solution implemented:**

1. **Trigger `trg_sync_reserved`** on `stock_reservations` (AFTER INSERT / UPDATE OF status, quantity / DELETE) recalculates the exact sum atomically inside the same transaction:
   ```sql
   SELECT COALESCE(SUM(quantity), 0)
   FROM   stock_reservations
   WHERE  company_id = … AND product_id = … AND location_id = …
     AND  (lot_id = … OR …)
     AND  status = 'active'
   ```
   This guarantees `quantity_reserved` is always the authoritative computed value, not an accumulated counter that can diverge.

2. **`quantity_available` is a GENERATED ALWAYS column** (`quantity_on_hand - quantity_reserved`) — the database computes it, application can never store a wrong value.

3. **Weekly drift detection** via `fn_reconcile_reservations()` — compare stored `quantity_reserved` vs real SUM, alert on any difference > 0.001.

4. **`CHECK (quantity_reserved <= quantity_on_hand)`** ensures the database rejects any state where reservations exceed stock, even if a trigger malfunctions.

---

### Issue 2: Ledger Duplication Risk

**Problem:** Partitioned tables cannot have cross-partition UNIQUE constraints. Duplicate `inventory_ledger` rows possible from retried API calls.

**Solution implemented:**

1. Added `idempotency_key TEXT` column to `inventory_ledger`. Application generates this as a deterministic hash:
   ```
   SHA-256(company_id || reference_type || reference_id || movement_type
           || product_id || COALESCE(lot_id,'') || COALESCE(from_loc_id,'')
           || COALESCE(to_loc_id,''))
   ```

2. Created **`inventory_ledger_dedup`** — a non-partitioned table with `idempotency_key TEXT PRIMARY KEY`. This provides a globally unique index that partitioned tables cannot have.

3. **Trigger `trg_ledger_dedup_check`** fires BEFORE INSERT on `inventory_ledger`:
   - Attempts INSERT into `inventory_ledger_dedup`
   - On `unique_violation`: raises an exception with `ERRCODE = 'unique_violation'` so the application can detect and return a 200 (already processed) response rather than a 500.

4. **Cleanup function** `fn_cleanup_ledger_dedup(p_days_old)` removes entries older than 30 days (sufficient dedup window; retries are typically milliseconds-to-seconds).

**Application responsibility:** Generate idempotency_key before INSERT. Cache the dedup key in Redis for fast-path check before hitting the DB.

---

### Issue 3: Missing Critical Constraints

All business rules previously enforced only at the application layer are now DB-enforced:

| Constraint | Table | Mechanism |
|---|---|---|
| `picked_quantity <= allocated_quantity` | `outbound_allocations` | `CHECK` constraint |
| `received_quantity <= expected_quantity × 1.10` | `inbound_order_lines` | `BEFORE UPDATE` trigger `fn_guard_received_quantity()` (trigger allows 10% tolerance; override by re-setting expected_quantity first) |
| `quantity_reserved <= quantity_on_hand` | `current_stock` | `CHECK` constraint |
| `quantity_on_hand >= 0` | `current_stock` | `CHECK` constraint |
| `quantity_reserved >= 0` | `current_stock` | `CHECK` constraint |
| `amount = ROUND(qty × unit_price, 2)` | `billing_transactions` | `BEFORE INSERT` trigger |
| `amount ≈ ROUND(qty × unit_price, 2)` | `invoice_lines` | `CHECK` with 0.01 tolerance |

The 10% tolerance on `received_quantity` reflects real warehouse practice (slight over-delivery is common). If an operator needs to record more than 110% of expected, a WH Manager must first update `expected_quantity`.

---

### Issue 4: RLS Context Leakage

**Problem:** `set_config('app.current_company_id', value, is_local=TRUE)` is transaction-local when inside a transaction, but **session-local** outside one. With session-mode connection pooling, a stale company_id from a previous request could persist.

**Solution implemented:**

1. **`fn_set_app_context()` already uses `is_local=TRUE`** — correct behavior inside transactions.

2. **Deployment requirement: PgBouncer in TRANSACTION mode.** In transaction mode:
   - Each query or transaction gets a server connection from the pool
   - When the transaction ends, the connection is returned and GUC settings reset
   - `is_local=TRUE` is always transaction-scoped → no leakage possible

3. **Prisma middleware pattern:**
   ```typescript
   // ✅ Correct: context set inside explicit transaction
   await prisma.$transaction([
     prisma.$executeRaw`SELECT fn_set_app_context(${userId}, ${companyId}, ${role})`,
     // all business queries here
   ]);

   // ❌ Wrong: context set outside transaction (session-scoped in non-PgBouncer-tx mode)
   await prisma.$executeRaw`SELECT fn_set_app_context(...)`;
   await prisma.products.findMany();
   ```

4. **`FORCE ROW LEVEL SECURITY`** is set on all tenant-scoped tables — even the table owner is subject to RLS, preventing accidental bypass.

5. **`RESTRICTIVE` policy `pol_client_boundary`** acts as a hard ceiling: no combination of `PERMISSIVE` policies can grant access outside the session's company — the restrictive policy always applies AND overrides.

---

### Issue 5: Deadlock Risk in Stock Updates

**Problem:** Outbound orders with multiple lines allocate stock from multiple `current_stock` rows. Two concurrent allocations for different orders touching overlapping products can deadlock if rows are locked in different orders.

**Solution implemented:**

1. **`fn_lock_stock_rows_ordered(p_stock_ids UUID[])`** — helper function that acquires `FOR UPDATE` locks in a **deterministic order** (`ORDER BY company_id, product_id, location_id`):
   ```sql
   SELECT * FROM current_stock
   WHERE  id = ANY($ids)
   ORDER  BY company_id, product_id, location_id
   FOR    UPDATE;
   ```

2. **Application contract:** All code paths that update multiple `current_stock` rows in one transaction MUST call `fn_lock_stock_rows_ordered()` first with the full set of row IDs. This is documented in the function definition and enforced via code review.

3. **Retry strategy** in the application layer (NestJS service):
   ```typescript
   async function withDeadlockRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
     for (let attempt = 1; attempt <= maxRetries; attempt++) {
       try {
         return await fn();
       } catch (err) {
         if (err.code === '40P01' && attempt < maxRetries) { // deadlock_detected
           await sleep(Math.random() * 50 * attempt); // jitter backoff
           continue;
         }
         throw err;
       }
     }
   }
   ```

4. **pg_stat_activity monitoring** — alert if any transaction holds locks for > 30 seconds (early deadlock detection).

---

### Issue 6: Billing Precision & Financial Correctness

**Problem:** Potential rounding inconsistency between application-computed amounts and DB-stored amounts.

**Solution implemented:**

| Element | Decision |
|---|---|
| Rate columns | `DECIMAL(10,4)` — 4 decimal places (captures fractional SAR/USD per unit) |
| Amount columns | `DECIMAL(14,2)` — 2 decimal places (final SAR/USD monetary amounts) |
| Rounding rule | `ROUND(quantity × unit_price, 2)` — standard half-up rounding at the point of each line |
| Invoice total | `SUM(invoice_lines.amount)` then `ROUND(subtotal × tax_rate, 2)` for tax — no re-rounding of already-rounded lines |
| Audit | `rate_snapshot JSONB` stores all plan rates at billing time for complete reproducibility |

**BEFORE INSERT trigger `fn_billing_tx_compute_amount()`** computes `amount` from `quantity × unit_price` at the database level, overriding any application-provided value. The application cannot insert an inconsistent amount.

**Invoice `CHECK` constraints** verify:
- `ABS(tax_amount - ROUND(subtotal × tax_rate, 2)) < 0.01`
- `ABS(total - (subtotal + tax_amount)) < 0.01`

Tolerance of 0.01 SAR accounts for floating-point rounding differences in client-provided values during draft phase; posted invoices are recomputed from authoritative line sums.

---

### Issue 7: Partition Reliability Risk

**Problem:** If the monthly BullMQ cron job fails to create the next partition, INSERTs into `inventory_ledger` or `billing_transactions` raise an error for the new month.

**Three-layer defense:**

1. **DEFAULT partitions** (`inventory_ledger_default`, `billing_transactions_default`, `audit_logs_default`) — PostgreSQL routes unmatched rows here instead of raising an error. The system continues operating.

2. **Monitoring function** `fn_monitor_default_partitions()` — detect rows in DEFAULT partitions (signals a missing named partition). Integrated into the health-check endpoint and alerting pipeline.

3. **Auto-create function** `fn_create_next_partitions(p_months_ahead=3)` runs 3 months ahead. Even if a single cron run is missed, 2 months of safety remain.

**Operational procedure when DEFAULT partition has rows:**
```sql
-- 1. Create the missing partition (no data loss — rows are safe in DEFAULT)
SELECT fn_create_next_partitions(1);

-- 2. Move rows from DEFAULT to the new named partition
-- (PostgreSQL 17+: ALTER TABLE ... ATTACH PARTITION with routing)
-- For PG 16: INSERT INTO ledger_YYYY_MM SELECT * FROM inventory_ledger_default;
--            DELETE FROM inventory_ledger_default WHERE created_at between X and Y;

-- 3. Verify DEFAULT is empty
SELECT * FROM fn_monitor_default_partitions();
```

---

## 8. Scaling Strategy

### 8.1 Current Scale Targets

| Metric | Target |
|---|---|
| Scans per minute | 1,000 |
| Active concurrent connections | 100 (via PgBouncer pool of 20 server connections) |
| inventory_ledger rows/year | ~10M |
| billing_transactions rows/year | ~500K |
| audit_logs rows/year | ~5M |

### 8.2 Database Tier

**Connection Pooling:**
```
Application (100 connections) ──► PgBouncer (pool_size=20, mode=transaction)
                                  ──► PostgreSQL Primary (max_connections=100)
```

PgBouncer in transaction mode: 100 app connections served by 20 server connections. OLTP workloads are fast (< 50ms per transaction), so effective throughput far exceeds connection count.

**Read Replicas:**
- One streaming replica for OLTP reads (list endpoints, stock checks, reporting)
- One streaming replica dedicated to BI/analytics (Metabase, Grafana)
- Application uses `PrismaClient` with read/write split:
  - Reads via: `prisma.$replica.tableName.findMany()`
  - Writes via: `prisma.tableName.create()`

**Table Partitioning:**
- `inventory_ledger`: monthly range partitions → queries for "last 30 days" hit 1–2 partitions
- `billing_transactions`: monthly range partitions → invoice generation queries for a month hit 1 partition
- `audit_logs`: quarterly range partitions → compliance queries hit 1–4 partitions
- Analytics facts: same monthly partitioning → BI queries for a month use partition pruning

**Indexing Strategy:**
- Partial indexes on hot paths: `WHERE status IN ('pending','assigned')`, `WHERE is_current = TRUE`, `WHERE invoice_id IS NULL`
- INCLUDE indexes to avoid heap lookups on high-frequency list queries
- GIN trigram indexes on `products.name` and `products.sku` for barcode lookup and search

### 8.3 Redis Caching Strategy

| Cache Key | TTL | Invalidation |
|---|---|---|
| `barcode:{value}` → entity | 5 min | On barcode re-assignment |
| `stock:{company}:{product}:{location}` | 30 sec | On `current_stock` UPDATE |
| `token_version:{user_id}` → version | 15 min | On password change / deactivation |
| `idempotency:{key}` → response | 10 min | Auto-expire |
| `active_plan:{company_id}` | 1 hour | On plan assignment change |

Cache invalidation uses `NOTIFY/LISTEN` channels: PostgreSQL triggers emit `pg_notify('cache_invalidate', payload)` on relevant table changes. NestJS listens and removes affected keys.

### 8.4 High-Throughput Write Patterns

**Inventory Ledger (1,000 scans/min peak):**
- PgBouncer transaction mode prevents connection exhaustion
- Monthly partitions: each partition handles ~1 month of writes then becomes cold
- `autovacuum_vacuum_scale_factor=0.01` ensures frequent vacuuming as dead tuples accumulate
- Deduplication via `inventory_ledger_dedup` uses primary key lookup (O(1)) — negligible overhead

**Current Stock UPSERT (atomic, optimistic):**
```sql
INSERT INTO current_stock (company_id, product_id, location_id, warehouse_id, lot_id,
    quantity_on_hand, last_movement_at, version)
VALUES (…)
ON CONFLICT ON CONSTRAINT uq_stock_bare_position
DO UPDATE SET
    quantity_on_hand = current_stock.quantity_on_hand + EXCLUDED.quantity_on_hand,
    last_movement_at = NOW(),
    version          = current_stock.version + 1
WHERE current_stock.version = <expected_version>;  -- optimistic lock check
```
If version mismatch (0 rows updated), application retries the entire transaction.

### 8.5 ETL Performance

**Incremental fact loads** process only new rows since last watermark. At 1,000 scans/min, the 15-minute inventory movement ETL processes ~15,000 rows per run — well within a 60-second window.

**Dimension merges** are infrequent (nightly) and touch small row counts (companies, products rarely number above 100K). The SCD2 merge loop is acceptable; for very large product catalogs (1M+), switch to a bulk MERGE using `WITH changed AS (...)`.

---

## 9. Trade-offs

### 9.1 Star Schema vs OLTP-only Reporting

| Aspect | OLTP Queries Only | Star Schema (current) |
|---|---|---|
| Report freshness | Real-time | Up to 24-hour lag (configurable) |
| Report query speed | Slow on large datasets (JOINs across partitions) | Fast (pre-joined, pre-aggregated, indexed surrogate keys) |
| Historical accuracy | Can lose history when OLTP data is updated | SCD2 preserves full history |
| Operational complexity | Low | Medium (ETL pipeline to maintain) |
| Storage | No duplication | ~30-40% data duplication |

**Decision:** Accept the complexity of maintaining an analytics schema. The SCD Type 2 history, pre-computed facts, and analytical query performance are essential for the billing reports and KPI dashboards that clients and management depend on.

### 9.2 Inventory Ledger Dedup vs Application-Only Idempotency

| Approach | Pros | Cons |
|---|---|---|
| Redis only | Fastest (sub-ms) | Redis is not durable; can miss retries after crash |
| DB idempotency_keys only | Durable, but scoped to API-level | Does not protect against direct DB inserts or re-tries that bypass the API |
| **Dedup table (chosen)** | Durable + DB-level + works for direct DB calls | Extra table to maintain; dedup window (30 days) must be managed |

The three-tier approach (Redis → `idempotency_keys` → `inventory_ledger_dedup`) provides defense in depth. Each layer is fast-path for the next.

### 9.3 SCD Type 2 vs SCD Type 1

SCD Type 2 has a cost: every dimension query requires `WHERE is_current = TRUE` or a date-range predicate. Without it, a single product joins to multiple rows. The partial indexes `WHERE is_current` mitigate the performance impact.

**Alternative considered:** Store dimension attributes directly on fact rows (denormalize). Rejected because: (a) significant storage increase for large fact tables, (b) inconsistent snapshots if the ETL is partial.

### 9.4 Modular Monolith vs Microservices

At the current scale (single-region, single-tenant DB, < 1,000 active users), microservices add overhead with no benefit:
- Cross-service transactions become sagas (complex compensating actions)
- Service mesh, container orchestration, distributed tracing are high operational costs
- Latency increases (network hops for synchronous service calls)

**Migration path to microservices** is preserved:
- Each NestJS module communicates only through its public service interface (no cross-module direct DB queries)
- Events are emitted via an in-process bus (EventEmitter2) but the interface is abstracted — swapping to Kafka requires only changing the bus implementation, not event producers/consumers
- Each module can be extracted when it has distinct scaling needs (e.g., Barcode module at 5,000+ scans/min)

### 9.5 DEFAULT Partitions as Fallback

Using DEFAULT partitions means out-of-range data is silently accepted rather than causing an error. This is intentional: **availability over strict correctness** at the partition boundary. The monitoring function `fn_monitor_default_partitions()` ensures the ops team is alerted within minutes. Rows are then migrated to the correct named partition with no data loss.

---

## Appendix A: BullMQ Job Schedule Summary

```
Cron: "*/15 * * * *"  → etl_load_fact_inventory_movements()   (every 15 min)
Cron: "0 0 * * *"     → etl_load_fact_stock_snapshot()        (midnight UTC)
Cron: "0 1 * * *"     → all dimension merges                  (1 AM UTC)
Cron: "0 2 * * *"     → fact_billing + fact_inbound + fact_outbound (2 AM UTC)
Cron: "0 3 * * *"     → analytics.etl_run_all()               (3 AM UTC — full run)
Cron: "0 4 * * *"     → fn_cleanup_idempotency_keys()
                          fn_cleanup_old_notifications()
                          fn_cleanup_ledger_dedup()
Cron: "0 4 1 * *"     → fn_create_next_partitions(3)
                          analytics.etl_create_next_fact_partitions(3)
                          fn_create_next_audit_partitions(2)
```

## Appendix B: Monitoring Queries

```sql
-- Check DEFAULT partition health (run from health-check endpoint)
SELECT * FROM fn_monitor_default_partitions();

-- Check ETL watermark freshness
SELECT table_name,
       last_loaded_at,
       NOW() - last_loaded_at AS lag,
       status
FROM   analytics.etl_watermarks
ORDER  BY lag DESC;

-- Check reservation drift (run weekly)
SELECT COUNT(*) FROM fn_reconcile_reservations();

-- Check worker load distribution
SELECT * FROM v_worker_load ORDER BY load_score DESC;

-- Uninvoiced billing (run before invoice generation)
SELECT * FROM v_uninvoiced_billing;
```

## Appendix C: Index Maintenance

```sql
-- Identify bloated indexes after high-write periods
SELECT schemaname, tablename, indexname,
       pg_size_pretty(pg_relation_size(indexrelid)) AS size,
       idx_scan, idx_tup_read, idx_tup_fetch
FROM   pg_stat_user_indexes
ORDER  BY pg_relation_size(indexrelid) DESC
LIMIT  20;

-- Rebuild bloated index concurrently (no table lock)
REINDEX INDEX CONCURRENTLY idx_ledger_company;
```
