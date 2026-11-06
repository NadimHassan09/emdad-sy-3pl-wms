# PERFORMANCE-READINESS-GATE.md

**Phase:** PERF-NORM-1 — Phase 8  
**Date:** 2026-06-01  
**Environment:** `wms_db_staging` @ localhost  
**Scope:** Data normalization only — no application changes

---

## Gate checklist

| # | Requirement | Status | Evidence |
|---|-------------|:------:|----------|
| 1 | Pre-migration snapshot documented | Pass | `PRE-NORMALIZATION-SNAPSHOT.md` |
| 2 | Rollback path documented | Pass | `ROLLBACK-PLAN.md` + `backups/wms_db_staging_pre_perf_norm_20260531.dump` |
| 3 | WH-001 validated as primary | Pass | `PRIMARY-WAREHOUSE-VALIDATION.md` |
| 4 | Stock consolidated to WH-001 | Pass | 10,263 / 10,263 rows (100%) |
| 5 | Quantities preserved | Pass | 53,827.0000 on-hand before/after |
| 6 | Duplicates merged | Pass | 39,756 slices removed; 9,855 multi-wh groups |
| 7 | Location capacity sufficient | Pass | 11,000 bins for 10,263 positions |
| 8 | Workflows/tasks on WH-001 | Pass | 100% / 100% |
| 9 | Empty PERF/WHit warehouses removed | Pass | 170 deleted; 153 PERF shells gone |
| 10 | Re-audit success criteria | Pass | `DATASET-INTEGRITY-AUDIT-V2.md` |
| 11 | Production untouched | Pass | `wms_db` still seed-scale |
| 12 | No application code changes | Pass | SQL + reports only |

---

## Success criteria (required)

| Metric | Threshold | Result |
|--------|-----------|--------|
| WH-001 visible stock | ≥ 95% | **100%** |
| WH-001 visible tasks | ≥ 95% | **100%** |
| WH-001 visible workflows | ≥ 95% | **100%** |
| Duplicate stock positions | 0 | **0** |
| Active orphan PERF warehouses | 0 | **0** |

---

## Exact operations summary

| Operation | Count |
|-----------|------:|
| Stock slices deleted (merge) | **39,756** |
| Stock survivors updated | **10,263** |
| Workflow instances remapped to WH-001 | **4,283** |
| Workers remapped to WH-001 | **8** |
| Norm bin locations created | **11,000** |
| Locations deleted (cleanup) | **1,912** |
| Warehouses deleted | **170** |
| Warehouses set inactive (ledger FK) | **24** |

---

## Known caveats (proceed with awareness)

1. **Stock row count** is **10,263**, not 50,019 — duplicate slices were merged (correct for single-warehouse realism).  
2. **4,953 orders** lack workflow instances — may affect order-linked perf scenarios.  
3. **24 inactive warehouses** remain for `inventory_ledger` FK integrity (no operational stock).  
4. **40 integration-test companies** remain in `companies` table (no perf stock).  
5. Certify on **staging only** until production load is explicitly requested.

---

## Final verdict

# READY_FOR_PERFORMANCE_CERTIFICATION

The staging performance dataset is normalized for **single active warehouse (WH-001)** operation. Proceed to **PERF-AUDIT-1** (benchmarking) against `wms_db_staging` using WH-001-scoped workloads.

**Do not** interpret pre-normalization 50k stock row targets as the operational cardinality — use **10,263 positions** and **53,827 units** as the realistic inventory baseline.
