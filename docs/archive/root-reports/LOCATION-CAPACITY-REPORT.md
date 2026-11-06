# LOCATION-CAPACITY-REPORT.md

**Phase:** PERF-NORM-1 — Phase 4  
**Warehouse:** WH-001

---

## Problem (pre)

| Metric | Value |
|--------|------:|
| WH-001 locations | 14 |
| Stock rows (global, pre-merge) | 50,019 |
| Distinct stock keys (post-merge target) | 10,263 |

14 bins could not hold 10,263 unique `(company_id, product_id, location_id, lot_id)` positions.

---

## Structure created

| Level | Name | Type | Barcode |
|-------|------|------|---------|
| Zone | Zone NORM | `warehouse` | `WH-001-NORM-ZONE` |
| Aisle | Aisle NORM-A | `iss` | `WH-001-NORM-A` |
| Bins | Bin 1 … Bin 11000 | `internal` | `WH-001-NORM-BIN-#####` |

**Path pattern:** `WH-001/NORM/A/{bin}`  
**Rack/bin metadata:** `rack` = R1–R110, `bin` = 01–100 per rack (synthetic grid)

---

## Capacity

| Metric | Count |
|--------|------:|
| New norm bins inserted | **11,000** |
| Distinct stock keys assigned | **10,263** |
| Headroom bins unused | ~737 |

Each merged stock position received **one dedicated bin** → no unique-index collisions.

---

## WH-001 location totals (post)

| Metric | Approx. |
|--------|--------:|
| Pre-existing WH-001 locations | 14 |
| New NORM bins | 11,000 |
| **Total WH-001 locations** | **~11,014** |

(Plus legacy locations on 24 **inactive** warehouses retained for ledger FK integrity.)

---

## Constraints satisfied

| Requirement | Status |
|-------------|--------|
| Realistic hierarchy (zone → aisle → bin) | Yes |
| Unique `locations.barcode` | Yes (`WH-001-NORM-BIN-*`) |
| Support all normalized stock rows | Yes (10,263 ≤ 11,000) |
| Active status for new bins | Yes |

---

## Cleanup impact

`perf-norm-1-cleanup.sql` deleted **1,912** locations in removable warehouses that were **not** referenced by `inventory_ledger` or `current_stock`.

**24** warehouses remain **inactive** with locations still referenced by **24** `inventory_ledger` rows (historical — not deleted).
