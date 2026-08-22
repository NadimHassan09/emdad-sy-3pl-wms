# STOCK-NORMALIZATION-REPORT.md

**Phase:** PERF-NORM-1 — Phase 3  
**Script:** `scripts/perf-norm-1-migrate.sql`  
**Database:** `wms_db_staging`

---

## Summary

| Metric | Before | After |
|--------|-------:|------:|
| Stock rows | 50,019 | **10,263** |
| Rows in WH-001 | 728 | **10,263** |
| Rows outside WH-001 | 49,291 | **0** |
| Sum `quantity_on_hand` | 53,827.0000 | **53,827.0000** |
| Sum `quantity_reserved` | (preserved) | (preserved via merge SUM) |
| Negative qty rows | 0 | **0** |
| `quantity_reserved > quantity_on_hand` | 0 | **0** |

**Quantity preserved:** Yes — total on-hand unchanged.

---

## Duplicate detection & merge

Merge key: `(company_id, product_id, lot_id, package_id)` (NULL-safe).

| Metric | Count |
|--------|------:|
| Distinct positions after merge | 10,263 |
| Slices merged away (rows deleted) | **39,756** |
| Groups spanning multiple warehouses | **9,855** |

Merge rule:

- Survivor row: prefer existing **WH-001** slice, else smallest `id`  
- `quantity_on_hand` / `quantity_reserved`: **SUM** across slices  
- `status`: from survivor preference  
- `last_movement_at`: **MAX** across slices  

---

## Relocation to WH-001

| Action | Count |
|--------|------:|
| Survivor rows updated (`warehouse_id`, `location_id`, quantities) | **10,263** |
| Each position assigned unique WH-001 bin | **10,263** (`WH-001-NORM-BIN-00001` …) |

Non-survivor rows deleted **before** location assignment to avoid unique-index conflicts on:

- `uq_stock_lot_position (company_id, product_id, location_id, lot_id)`  
- `uq_stock_bare_position` / `uq_stock_package_position`  

---

## Integrity checks (post)

| Check | Result |
|-------|--------|
| All stock in WH-001 | Pass (100%) |
| No negative quantities | Pass |
| Reserved ≤ on-hand | Pass |
| Duplicate `(company_id, product_id, location_id, lot_id)` | **0** (expected) |

---

## Exact operations (from migration execution log)

```
DELETE 39756   -- non-survivor stock slices
UPDATE 10263   -- survivors → WH-001 + merged qty + new locations
```

---

## What was not changed

- `products` (tenant ownership unchanged)  
- `lots` (references unchanged)  
- `inventory_ledger` (historical rows; location FKs may still point at inactive WH locations)  
- Application code / APIs  
