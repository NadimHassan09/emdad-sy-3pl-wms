# PRIMARY-WAREHOUSE-VALIDATION.md

**Phase:** PERF-NORM-1 — Phase 2  
**Primary warehouse:** `WH-001` / `00000000-0000-4000-8000-000000000010`

---

## Database validation

| Check | Result |
|-------|--------|
| Warehouse exists | Yes |
| Code | `WH-001` |
| Status | `active` |
| Name | Main Warehouse |
| Created | 2026-05-11 (seed) |

```sql
SELECT id, code, name, status FROM warehouses WHERE code = 'WH-001';
```

---

## UI default warehouse (code reference — not modified)

`frontend/src/hooks/useDefaultWarehouse.ts` resolves warehouse in order:

1. `VITE_DEFAULT_WAREHOUSE_ID` (if valid in list)  
2. `code === 'WH-001'`  
3. First `active` warehouse  
4. First warehouse in list  

**Conclusion:** UI targets **WH-001** when active.

---

## Backend workflow / worker defaults (code reference — not modified)

| Component | Rule |
|-----------|------|
| `UsersService.resolveWorkerWarehouseId()` | Explicit ID → else `WH-001` by code |
| `workflow-bootstrap` / task services | Use `warehouseId` from workflow instance or confirm body |

**Conclusion:** Backend treats **WH-001** as the main operational warehouse.

---

## Post-normalization operational state

| Check | Status |
|-------|--------|
| All `current_stock.warehouse_id` | WH-001 only (10,263 rows) |
| All `workflow_instances.warehouse_id` | WH-001 only (5,057 rows) |
| All `warehouse_tasks` via workflow | WH-001 only (10,000 rows) |
| Workers with warehouse set | Remapped to WH-001 (8 updated during migration) |

---

## Other warehouses after cleanup

| Category | Count | Notes |
|----------|------:|-------|
| Active (operational) | 6 | WH-001 + 5 seed tenants with no perf stock |
| Inactive (ledger history) | 24 | `WHit-*` / `WH1` — locations referenced by `inventory_ledger` (24 ledger rows) |
| Deleted | 170 | Empty `PERF-WH-*` and deletable test shells |

**WH-001 is the sole active warehouse carrying benchmark stock and workflows.**

---

## Verdict

**WH-001 validated** as the single primary operational warehouse for performance certification on staging.
