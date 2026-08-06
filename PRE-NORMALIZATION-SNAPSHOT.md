# PRE-NORMALIZATION-SNAPSHOT.md

**Phase:** PERF-NORM-1 — Phase 1  
**Database:** `wms_db_staging` (localhost)  
**Captured:** 2026-06-01 (before normalization SQL)  
**Backup:** `/var/www/emdad-sy-3pl-wms/backups/wms_db_staging_pre_perf_norm_20260531.dump` (6.4 MB, custom format)

---

## Global entity counts

| Entity | Count |
|--------|------:|
| Products | 10,041 |
| Stock rows (`current_stock`) | 50,019 |
| Inventory qty on hand (sum) | 53,827.0000 |
| Inbound orders | 5,002 |
| Outbound orders | 5,008 |
| Warehouse tasks | 10,000 |
| Workflow instances | 5,057 |
| Warehouses | 200 |
| Locations | 2,000 |
| Users | 100 |
| Companies | 46 |

---

## Primary warehouse (reference)

| Field | Value |
|-------|-------|
| Code | `WH-001` |
| ID | `00000000-0000-4000-8000-000000000010` |
| Name | Main Warehouse |
| Status | active |

---

## WH-001 visibility (pre-normalization)

| Metric | WH-001 | Other | % on WH-001 |
|--------|-------:|------:|------------:|
| Stock rows | 728 | 49,291 | 1.46% |
| Tasks (via workflow) | 1,427 | 8,573 | 14.27% |
| Workflow instances | 530* | 4,527* | 10.48%* |

\*Inbound/outbound workflow counts from prior PERF-AUDIT-0; total workflows 5,057.

---

## Known integrity issues (from PERF-AUDIT-0)

- 9,855 product/lot slices duplicated across 5 `WHit-*` integration warehouses  
- 153 empty `PERF-WH-*` warehouse shells  
- 8,549 tasks on legacy warehouse `WH1` (zero stock)  
- 197 inbound / 4,756 outbound orders without workflow instances  

---

## Production comparison (not modified)

| Entity | `wms_db` (production) |
|--------|----------------------:|
| Products | 2 |
| Stock rows | 11 |
| Warehouses | 2 |

Performance dataset exists **only on staging**.
