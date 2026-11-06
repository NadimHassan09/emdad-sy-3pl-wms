# WAREHOUSE-CLEANUP-REPORT.md

**Phase:** PERF-NORM-1 — Phase 6  
**Script:** `scripts/perf-norm-1-cleanup.sql`  
**Database:** `wms_db_staging`

---

## Summary

| Action | Count |
|--------|------:|
| Locations deleted | **1,912** |
| Warehouses deleted | **170** |
| Warehouses marked **inactive** (ledger FK) | **24** |
| Warehouses remaining | **30** |

---

## Removal criteria

Target warehouses (non–WH-001):

- `PERF-WH-%` (generator shells)  
- `WHit-%` / `WHoc-%` (integration test)  
- `WH1` (legacy duplicate “Main Warehouse”)  
- `WH` (stray code, if present)  

**Location delete rule:** location in target warehouse **AND** not in `inventory_ledger` **AND** no `current_stock`.

**Warehouse delete rule:** marked for removal **AND** zero remaining locations.

**Warehouse inactive rule:** marked for removal **AND** still has locations (ledger history).

---

## FK blocker (documented)

```
inventory_ledger_from_location_id_fkey / to_location_id_fkey
```

**24** ledger rows reference locations in **24** former test warehouses → those warehouses were set to **`inactive`** instead of deleted.

---

## Remaining warehouse inventory (post-cleanup)

| Type | Approx. count | Role |
|------|---------------|------|
| **WH-001** | 1 | Sole **active** warehouse with stock, tasks, workflows |
| Seed tenants (active, empty) | ~5 | Nahdi, Falcon, Desert, Riyadh, WorkerTest — no perf stock |
| Inactive (ledger) | 24 | Historical integration / WH1 locations |

**No empty `PERF-WH-*` warehouses remain** (all 153 deleted).

**No `WHit-*` active warehouses remain** (inactive or deleted).

---

## Orphan locations

- **0** stock rows outside WH-001  
- Non–WH-001 locations only exist on **inactive** warehouses for ledger referential integrity  
- No operational orphan stock  

---

## Not removed (by design)

- Integration-test **companies** (`IT *`) — 40 companies; out of scope for warehouse cleanup  
- `inventory_ledger` rows — historical audit trail preserved  
- Products / orders — unchanged counts  
