# DATASET-INTEGRITY-AUDIT.md

**Phase:** PERF-AUDIT-0 — Dataset Integrity & Tenant Distribution Audit  
**Date:** 2026-05-31  
**Method:** Read-only SQL against live PostgreSQL databases. No application code was modified. No benchmarks were run.

---

## Executive summary

The certified performance dataset **exists only on staging** (`wms_db_staging`). **Production** (`wms_db`) contains seed-scale data (2 products, 11 stock rows, 2 warehouses) and is **not** the performance dataset.

On staging, **global row counts match the certified targets** (≈10k products, ≈50k stock, ≈5k orders, 10k tasks, 200 warehouses, 2k locations). However, **warehouse and workflow placement do not match the single-warehouse production model**:

| Concern | Evidence |
|--------|----------|
| Primary warehouse `WH-001` holds **1.5%** of stock rows | 728 / 50,019 |
| **98.5%** of stock is in integration-test warehouses (`WHit-*`) | 49,291 rows |
| **85.5%** of tasks sit on legacy warehouse `WH1`, not `WH-001` | 8,549 / 10,000 |
| **153** `PERF-WH-*` warehouses are empty shells (locations only) | 0 stock, 0 tasks |
| **9,855** Acme products are **duplicated** across 5 `WHit-*` warehouses | same `product_id` in 5 warehouses |

**Verdict:** **DATASET INVALID FOR PERFORMANCE CERTIFICATION** under the current single-warehouse (`WH-001`) deployment model. Benchmarks that exercise UI/API paths scoped to the primary warehouse will **not** see the certified load.

---

## Database scope

| Database | Host | Used by | Perf dataset? |
|----------|------|---------|----------------|
| `wms_db` | localhost | Production (`admin.emdadsy.com`) | **No** — seed data only |
| `wms_db_staging` | localhost | Staging QA / perf work | **Yes** — certified counts |

All distribution analysis below is from **`wms_db_staging`** unless noted.

---

## Part 1 — Warehouse distribution audit

### 1. Primary warehouse (UI & business logic)

| Source | Resolution rule |
|--------|-----------------|
| Frontend `useDefaultWarehouseId()` | `VITE_DEFAULT_WAREHOUSE_ID` → else `code = 'WH-001'` → else first `active` warehouse |
| Backend `UsersService.resolveWorkerWarehouseId()` | Explicit ID → else `code = 'WH-001'` |
| Inventory / inbound / outbound list APIs | Filter by `query.warehouseId` when frontend passes default warehouse |

**Primary warehouse in database:**

| id | code | name | status |
|----|------|------|--------|
| `00000000-0000-4000-8000-000000000010` | **WH-001** | Main Warehouse | active |

**Secondary warehouses with operational impact:**

| code | name | role in dataset |
|------|------|-----------------|
| `WH1` | Main Warehouse | Legacy seed warehouse; **8,549 tasks**, 4,275 inbound workflows, **0 stock** |
| `WHit-*` (40 codes) | Integration-test warehouses | **49,291 stock rows** (5 warehouses hold ~9,857 rows each) |
| `PERF-WH-00001` … `PERF-WH-00153` | Perf Warehouse N | **153 empty shells** — 10 locations each, no stock/tasks |

### 2. Certified targets vs actual totals (staging)

| Entity | Target | Actual (SQL) | Δ |
|--------|--------|--------------|---|
| Products | 10,000 | **10,041** | +41 (integration-test companies) |
| Stock rows | 50,000 | **50,019** | +19 |
| Inbound orders | 5,000 | **5,002** | +2 |
| Outbound orders | 5,000 | **5,008** | +8 |
| Tasks | 10,000 | **10,000** | 0 |
| Users | 100 | **100** | 0 |
| Warehouses | 200 | **200** | 0 |
| Locations | 2,000 | **2,000** | 0 |

### 3. Warehouse distribution table

> **Note:** `products` = distinct products with stock in that warehouse (`COUNT(DISTINCT product_id)` from `current_stock`). The `products` table has no `warehouse_id`; products are tenant-scoped only.

#### 3a. Warehouses with operational data (10 of 200)

| Warehouse | Products | Stock rows | Inventory qty | Inbound | Outbound | Tasks |
|-----------|----------|------------|---------------|---------|----------|-------|
| WHit-1780186316823-2 | 9,856 | 9,857 | 9,860 | 0 | 1 | 3 |
| WHit-1780188953012-4 | 9,856 | 9,857 | 9,860 | 0 | 1 | 3 |
| WHit-1780190606056-1 | 9,856 | 9,857 | 9,860 | 0 | 1 | 3 |
| WHit-1780233746395-6 | 9,856 | 9,857 | 9,860 | 0 | 1 | 3 |
| WHit-1780234509033-9 | 9,856 | 9,857 | 9,860 | 0 | 1 | 3 |
| **WH-001 (primary)** | **396** | **728** | **4,512** | **530** | **244** | **1,427** |
| WHit-1780186010365-7 | 1 | 2 | 5 | 0 | 1 | 3 |
| WHit-1780188319025-4 | 1 | 2 | 5 | 0 | 1 | 3 |
| WHit-1780234527849-6 | 1 | 2 | 5 | 0 | 1 | 3 |
| WH1 | 0 | 0 | 0 | 4,275 | 0 | 8,549 |

#### 3b. Aggregated by warehouse group

| Group | Warehouses | Stock rows | Products (with stock) | Inventory qty | Tasks | Locations |
|-------|------------|------------|---------------------|---------------|-------|-----------|
| Integration-test (`WHit-*`, `WHoc-*`) | 40 | 49,291 | 49,283 | 49,315 | 24 | 396 |
| **Primary (`WH-001`)** | **1** | **728** | **396** | **4,512** | **1,427** | **14** |
| Legacy seed (`WH1`) | 1 | 0 | 0 | 0 | 8,549 | 10 |
| Generator shells (`PERF-WH-*`) | 153 | 0 | 0 | 0 | 0 | 1,530 |
| Other | 5 | 0 | 0 | 0 | 0 | 50 |
| **Total** | **200** | **50,019** | **49,679*** | **53,827** | **10,000** | **2,000** |

\*Distinct products across all warehouses: 9,863 with stock globally; 396 in WH-001.

#### 3c. Distribution summary

| Metric | Value |
|--------|-------|
| Warehouses with stock | **9** |
| Warehouses without stock | **191** |
| Max stock rows in one warehouse | **9,857** |
| Avg stock rows per warehouse (all 200) | **250.1** |
| Stock rows in **WH-001** | **728 (1.46%)** |
| Stock rows **not** in WH-001 | **49,291 (98.54%)** |

### 4. Visible vs hidden data (UI today, default `WH-001`)

Assumes admin UI paths that pass `warehouseId` from `useDefaultWarehouseId()` (inventory, inbound/outbound lists, locations, task execution panels). Products catalog is **not** warehouse-scoped.

| Metric | Visible in UI (WH-001) | Hidden (other warehouses / no WH-001 workflow) | % visible |
|--------|--------------------------|-----------------------------------------------|-----------|
| Stock rows | 728 | 49,291 | **1.5%** |
| Inventory qty (on hand) | 4,512 | 49,315 | **8.4%** |
| Products with stock | 396 | 9,467 | **4.0%** |
| Tasks (by workflow warehouse) | 1,427 | 8,573 | **14.3%** |
| Inbound (WH-001 workflow) | 530 | 4,472† | **10.6%** |
| Outbound (WH-001 workflow) | 244 | 4,764† | **4.9%** |
| Products (catalog, all tenants) | 10,041 | 0 | **100%** |

†Includes orders with **no** workflow on WH-001 (197 inbound and 4,756 outbound lack any workflow instance; most workflows that exist are on `WH1` or `WHit-*`).

**Acme-only stock in WH-001:** 725 rows (of Acme's 50,000 total stock rows = **1.45%**).

---

## Part 2 — Single-warehouse normalization plan

**Status: PLAN ONLY — do not execute without explicit approval.**

**Goal:** Consolidate all benchmark operational data into `WH-001` (`00000000-0000-4000-8000-000000000010`) so UI and API paths scoped to the primary warehouse reflect the certified load.

### 2.1 Records that must move or be remapped

| Table | Rows to change (estimate) | Action |
|-------|---------------------------|--------|
| `current_stock` | **49,291** rows (non–WH-001) | Reassign `warehouse_id` → WH-001 **and** `location_id` → equivalent WH-001 location (cannot change warehouse alone — FK via `locations.warehouse_id`) |
| `workflow_instances` | **~4,527** rows on WH1/WHit | Update `warehouse_id` → WH-001 |
| `warehouse_tasks` | **8,573** tasks (via workflow instances not on WH-001) | Indirect — follows `workflow_instances` |
| `locations` | Create **~1,986** net new locations in WH-001 (currently 14; need capacity for ~50k stock slices) **OR** collapse duplicate `WHit-*` stock first | Merge/deduplicate before location remap |
| `workers` | **18** with `warehouse_id` set | Point non–WH-001 workers to WH-001 |
| `stock_adjustments` | **3** | Update `warehouse_id` if not WH-001 |

**Deduplication prerequisite:** **9,855** Acme products appear in **5** `WHit-*` warehouses with identical quantities (5 units each). Consolidating to WH-001 requires **merging** these slices (same `company_id`, `product_id`, `lot_id`, `location_id` target) — not a simple `UPDATE warehouse_id`.

**Empty artifacts to remove after consolidation:**

| Artifact | Count | Action |
|----------|-------|--------|
| `PERF-WH-*` warehouses | 153 | Delete after confirming 0 dependent rows |
| `WHit-*` / `WHoc-*` test warehouses | 40 | Delete after stock/workflow migration |
| `WH1` legacy warehouse | 1 | Reassign 8,549 task workflows → WH-001, then delete if empty |

### 2.2 Foreign keys affected

```
warehouses
  ← locations.warehouse_id
  ← current_stock.warehouse_id
  ← workflow_instances.warehouse_id
  ← stock_adjustments.warehouse_id
  ← workers.warehouse_id (nullable)

locations
  ← current_stock.location_id
  ← stock_adjustment_lines.location_id
  ← inventory_ledger.from_location_id / to_location_id (historical — do not rewrite casually)

workflow_instances
  ← warehouse_tasks.workflow_instance_id
  ← workflow_nodes.instance_id

companies (unchanged — tenant scope is already correct for Acme bulk data)
products (unchanged — no warehouse_id column)
inbound_orders / outbound_orders (unchanged — warehouse scope is via workflow_instances)
```

### 2.3 Safety risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| `current_stock` unique constraints / version conflicts on merge | **High** | Merge in transaction; use existing adjustment patterns; validate `quantity_on_hand >= 0` checks |
| Location capacity — WH-001 has **14** locations for **50k** stock rows | **High** | Generate additional WH-001 locations before remap, or aggregate stock to product/lot level |
| `inventory_ledger` partition history references old location IDs | **Medium** | Do not rewrite ledger; accept historical location IDs differ from current_stock |
| Orphan workflows (197 inbound / 4,756 outbound without workflow) | **Medium** | Bootstrap workflows on WH-001 or exclude from perf scope |
| Integration-test companies (`IT *`) entangled with `WHit-*` warehouses | **Low** | Delete test companies/locations after Acme consolidation |
| Duplicate `WH1` vs `WH-001` both named "Main Warehouse" | **Low** | Deactivate/delete WH1 after task migration |

### 2.4 Proposed migration phases (rollback-friendly)

1. **Backup:** `pg_dump wms_db_staging` full snapshot.
2. **Inventory analysis script:** Map each non–WH-001 stock row → target WH-001 location (create locations in batches).
3. **Deduplicate `WHit-*` Acme stock:** Merge 5× duplicated product slices per product.
4. **Update `workflow_instances.warehouse_id`** for WH1/WHit → WH-001.
5. **Verify:** Re-run Part 1 SQL; expect ≥99% stock/tasks on WH-001.
6. **Cleanup:** Delete empty `PERF-WH-*`, test warehouses, optional test companies.
7. **Rollback:** Restore from `pg_dump` if counts or FK checks fail.

**Estimated row operations:** ~50k stock updates/merges, ~5k workflow updates, ~2k location inserts, ~200 warehouse deletes.

---

## Part 3 — Tenant / client distribution audit

### 3.1 All companies (46 total)

| Company | Products | Stock rows | Inbound | Outbound | Tasks | Users |
|---------|----------|------------|---------|----------|-------|-------|
| **Acme Imports** | **10,000** | **50,000** | **5,000** | **5,000** | **9,972** | **1** |
| WorkerTest Co | 1 | 3 | 2 | 0 | 4 | 0 |
| IT it-* / IT oc-* (40 companies) | 1 each | 0–2 | 0 | 0–1 | 0–3 | 0 |
| Nahdi Pharma | 0 | 0 | 0 | 0 | 0 | 0 |
| Falcon Foods | 0 | 0 | 0 | 0 | 0 | 0 |
| Desert Tech Co | 0 | 0 | 0 | 0 | 0 | 0 |
| Riyadh Textiles | 0 | 0 | 0 | 0 | 0 | 0 |

### 3.2 Questions A–D

| Question | Answer | SQL evidence |
|----------|--------|--------------|
| **A) Did generator create data for only ACME?** | **Mostly yes** for bulk perf data. Acme holds 10,000/10,041 products, 50,000/50,019 stock rows, 5,000/5,002 inbound, 5,000/5,008 outbound, 9,972/10,000 tasks. | Company aggregation query |
| **B) Products distributed across multiple companies?** | **Yes, minimally.** 42 companies have ≥1 product; only Acme has meaningful volume. +41 products belong to integration-test `IT *` companies. | `COUNT(DISTINCT company_id)` from products = 42 |
| **C) Stock distributed across multiple companies?** | **Yes, minimally.** 10 companies have stock; Acme = 50,000 rows; others = 19 rows combined. | Company stock counts |
| **D) Orders distributed across multiple companies?** | **Inbound: mostly Acme** (5,000/5,002). **Outbound: Acme 5,000 + 8 IT companies with 1 order each.** | Company order counts |

### 3.3 Users

| Scope | Count |
|-------|-------|
| System/internal users (`company_id IS NULL`) | 99 |
| Acme client user | 1 |
| Roles | 56 `wh_operator`, 42 `super_admin`, 1 `wh_manager`, 1 `client_admin` |

---

## Part 4 — Filtering bug detection

**Question:** Why does the UI mostly show Acme records?

### Case A — Dataset genuinely belongs mostly to Acme

**Supported: YES (company/tenant dimension)**

- Acme owns **99.6%** of products (10,000 / 10,041).
- Acme owns **99.96%** of stock rows.
- Seed + generator targeted Acme Imports (`00000000-0000-4000-8000-000000000001`).

### Case B — Backend filtering bug

**Not supported.**

- `readCompanyIdFilter()` intentionally returns `undefined` for internal roles when `query.companyId` is omitted — lists are **not** tenant-scoped unless requested (`company-read-scope.ts`).
- `products.service.list()` only filters by `query.companyId`, not headers alone.
- Warehouse filters apply only when `query.warehouseId` is present — by design in `inventory.service.ts`, `inbound.service.ts`, `outbound.service.ts`, `warehouse-tasks.service.ts`.

### Case C — Frontend filtering bug

**Not supported as a defect** — behavior matches single-warehouse design.

- `useDefaultWarehouseId()` resolves **WH-001** and passes it to inventory/inbound/outbound lists.
- `InventoryPage` always sends `warehouseId` (line 162–168).
- `TasksListPage` does **not** send `warehouseId` — tasks list is cross-warehouse (limit 500).
- `ProductsPage` default `companyId` filter is **empty** (all tenants); create-modal defaults to first company.

### Case D — Default warehouse / client selection

**Supported: YES (warehouse dimension) — primary cause of hidden perf data**

| Mechanism | Effect |
|-----------|--------|
| Default warehouse = **WH-001** | Hides **98.5%** of stock from inventory/location views |
| Workflows on **WH1** (8,549 inbound tasks) | Task/workflow work on wrong warehouse vs UI default |
| Stock placed in **`WHit-*`** integration warehouses | ~49k rows invisible to WH-001-scoped APIs |
| Production build sets `VITE_MOCK_COMPANY_ID=Acme` | Sends `X-Company-Id` header, but **internal JWT users ignore it** for list APIs unless query filter set |
| Dashboard KPIs | Explicitly **ignore** `X-Company-Id` (all-customer warehouse view) |

**Conclusion:** The UI shows Acme-heavy data at the **company** level because the dataset **is** Acme-heavy. Warehouse-scoped screens show **far less** than the certified totals because data was placed in **WH1** and **`WHit-*`**, not the primary **WH-001** warehouse the UI selects by default. This is a **dataset placement + default warehouse mismatch**, not a filtering bug.

---

## Part 5 — Dataset certification v2

### 5.1 Warehouse distribution summary

- Certified **200 warehouses** exist; **191 carry no stock**.
- **153** are empty `PERF-WH-*` location shells from the generator.
- **Real stock** concentrates in **5 integration-test warehouses** (~9,857 rows each, duplicated Acme catalog).
- **Primary WH-001** holds **728 stock rows (1.5%)** and **1,427 tasks (14.3%)**.
- **WH1** holds **85.5% of tasks** but **zero stock** — inconsistent operational state.

### 5.2 Client distribution summary

- Perf bulk data is **Acme-only** at meaningful scale.
- **41** extra products and **40** `IT *` test companies are integration-test residue.
- Four seeded multi-tenant companies (Nahdi, Falcon, Desert, Riyadh) have **zero** perf data.

### 5.3 Hidden vs visible data

Under default single-warehouse UI (`WH-001`), **~98.5% of stock** and **~85.7% of tasks** are hidden from warehouse-scoped surfaces. The products catalog shows all tenants (~10k Acme SKUs) regardless of warehouse.

### 5.4 Do benchmarks represent real load?

**No**, for the stated production model (one active warehouse):

- Production DB (`wms_db`) does not contain the perf dataset at all.
- Staging perf data is **not co-located** in the warehouse the application treats as primary.
- Task load splits across **WH1** and **WH-001**; stock splits across **`WHit-*`** and **WH-001**.
- **9,855 products are duplicated** across five warehouses — inflates stock row count without representing single-warehouse density.

### 5.5 Are performance numbers trustworthy?

**Not yet.** Any benchmark hitting WH-001-scoped endpoints measures **~1–15%** of certified entities. Global table counts overstate what the operational UI exercises. Results would **not** predict production single-warehouse behaviour without normalization (Part 2).

### 5.6 Recommended next actions

1. **Do not certify** current staging data for perf testing under single-warehouse assumptions.
2. **Execute Part 2 normalization** (or regenerate dataset) so ≥95% of stock, tasks, and workflows sit on **WH-001** with deduplicated stock.
3. **Remove** 153 empty `PERF-WH-*` shells and integration-test warehouse/company artifacts from perf DB.
4. **Fix workflow coverage:** 197 inbound and 4,756 outbound orders lack workflow instances — bootstrap or exclude from perf scope.
5. **Keep production (`wms_db`) separate** — do not load 50k-row perf data into production until explicitly requested.
6. **Re-run PERF-AUDIT-0** after normalization; gate PERF-AUDIT-1 benchmarks on **WH-001 visibility ≥ 95%**.

---

## Final verdict

### **DATASET INVALID FOR PERFORMANCE CERTIFICATION**

**Reason:** Global counts match targets, but **warehouse placement contradicts the single-warehouse production model**. The UI and business logic anchor on **WH-001**; **98.5% of stock** and **85.5% of tasks** live elsewhere. Production does not contain this dataset. Performance results taken before normalization would be **misleading**.

---

## Appendix — Key SQL references

```sql
-- Primary warehouse
SELECT id, code, name FROM warehouses WHERE code = 'WH-001';

-- Staging totals
SELECT COUNT(*) FROM products;          -- 10041
SELECT COUNT(*) FROM current_stock;     -- 50019
SELECT COUNT(*) FROM warehouse_tasks;   -- 10000
SELECT COUNT(*) FROM warehouses;        -- 200

-- WH-001 vs rest
SELECT
  SUM(CASE WHEN w.code = 'WH-001' THEN 1 ELSE 0 END) wh001_stock,
  SUM(CASE WHEN w.code <> 'WH-001' THEN 1 ELSE 0 END) other_stock
FROM current_stock cs JOIN warehouses w ON w.id = cs.warehouse_id;

-- Acme concentration
SELECT c.name, COUNT(p.id) products, COUNT(cs.id) stock
FROM companies c
LEFT JOIN products p ON p.company_id = c.id
LEFT JOIN current_stock cs ON cs.company_id = c.id
WHERE c.name = 'Acme Imports'
GROUP BY c.name;
```

**Auditor note:** All counts captured 2026-05-31 from `wms_db_staging` on localhost PostgreSQL unless labelled as production (`wms_db`).
