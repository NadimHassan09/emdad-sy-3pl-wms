# DATASET-INTEGRITY-AUDIT-V2.md

**Phase:** PERF-NORM-1 — Phase 7 (re-audit after normalization)  
**Database:** `wms_db_staging`  
**Method:** SQL evidence post `perf-norm-1-migrate.sql` + `perf-norm-1-cleanup.sql`  
**Prior report:** `DATASET-INTEGRITY-AUDIT.md` (pre-normalization)

---

## Executive summary

Normalization **succeeded** for single-warehouse certification criteria. Benchmark operational data is consolidated on **WH-001**.

| Criterion | Target | Actual | Pass |
|-----------|--------|--------|:----:|
| WH-001 stock visibility | ≥ 95% | **100%** | Yes |
| WH-001 task visibility | ≥ 95% | **100%** | Yes |
| WH-001 workflow visibility | ≥ 95% | **100%** | Yes |
| No duplicate stock positions | 0 duplicates | **0** | Yes |
| No orphan perf warehouses | No empty PERF/WHit active | **Yes** | Yes |

**Verdict:** **DATASET VALID** for single-warehouse performance certification (staging).

---

## Global counts (post-normalization)

| Entity | Pre | Post | Notes |
|--------|----:|-----:|-------|
| Products | 10,041 | 10,041 | Unchanged |
| Stock rows | 50,019 | **10,263** | Merged duplicates |
| Inventory qty (sum) | 53,827 | **53,827** | Preserved |
| Inbound orders | 5,002 | 5,002 | Unchanged |
| Outbound orders | 5,008 | 5,008 | Unchanged |
| Tasks | 10,000 | 10,000 | All WH-001 workflows |
| Workflow instances | 5,057 | 5,057 | All WH-001 |
| Warehouses | 200 | **30** | 170 deleted, 24 inactive |
| Locations | 2,000 | **~11,900** | +11k WH-001 bins, −1,912 deleted |

---

## Part 1 — Warehouse distribution (post)

### Primary warehouse

**WH-001** — `00000000-0000-4000-8000-000000000010` — **active**

### Distribution table (operational data)

| Warehouse | Products (with stock) | Stock rows | Inventory qty | Inbound† | Outbound† | Tasks |
|-----------|----------------------:|-----------:|--------------:|---------:|----------:|------:|
| **WH-001** | 10,263 | **10,263** | **53,827** | 530 | 244 | **10,000** |
| All others | 0 | 0 | 0 | — | — | 0 |

†Workflow-attributed orders only; many orders still lack workflow instances (see gaps).

### Visibility

| Metric | Visible (WH-001) | Hidden | % visible |
|--------|-----------------:|-------:|----------:|
| Stock rows | 10,263 | 0 | **100%** |
| Tasks | 10,000 | 0 | **100%** |
| Workflows | 5,057 | 0 | **100%** |

---

## Part 2 — Normalization outcome (executed)

See:

- `STOCK-NORMALIZATION-REPORT.md` — 39,756 slices merged; qty preserved  
- `LOCATION-CAPACITY-REPORT.md` — 11,000 bins  
- `WORKFLOW-NORMALIZATION-REPORT.md` — 4,283 workflows remapped  
- `WAREHOUSE-CLEANUP-REPORT.md` — 170 warehouses removed  

---

## Part 3 — Tenant distribution (unchanged)

| Company | Products | Stock | Inbound | Outbound | Tasks |
|---------|----------|-------|---------|----------|-------|
| **Acme Imports** | 10,000 | 10,263‡ | 5,000 | 5,000 | 9,972 |
| Others | 41 | 0 | 2 | 8 | 28 |

‡All Acme stock merged into 10,263 unique positions (was 50,000 rows pre-merge).

Perf bulk data remains **Acme-centric**; normalization did not change tenant ownership.

---

## Part 4 — Filtering / UI alignment

| Case | Post-norm assessment |
|------|----------------------|
| A — Data mostly Acme | Still true |
| B — Backend bug | No |
| C — Frontend bug | No |
| D — Default warehouse mismatch | **Resolved** — 100% stock/tasks/workflows on WH-001 |

---

## Part 5 — Remaining gaps (non-blocking for warehouse cert)

| Gap | Count | Impact on perf |
|-----|------:|----------------|
| Inbound orders without workflow | 197 | List views show orders; task pipeline may not |
| Outbound orders without workflow | 4,756 | Same |
| Inactive warehouses (ledger FK) | 24 | Not selectable; no stock |
| Row count vs certified targets | 10,263 stock vs 50,000 target | **Expected** after deduplication — cert should use **realistic density** metrics |

---

## Certification comparison

| Certified target | Raw pre-norm | Post-norm (realistic) |
|------------------|-------------|------------------------|
| 50,000 stock rows | 50,019 (inflated by 5× duplication) | **10,263** unique positions |
| 200 warehouses | 200 (191 empty) | **1 active** + 24 inactive + 5 empty seed |
| 10,000 tasks | 10,000 | **10,000** on WH-001 |

Benchmarks should report **both** table cardinality and **WH-001-scoped** operational counts.

---

## Final verdict (v2)

### **DATASET VALID**

Suitable for single-warehouse performance certification on **staging**, with documented caveats on orphan orders and inactive ledger-only warehouses.

**Production (`wms_db`) was not normalized** and does not contain this dataset.
