# ROLLBACK-PLAN.md

**Phase:** PERF-NORM-1 — Phase 1  
**Database:** `wms_db_staging`

---

## Pre-change backup

| Item | Path |
|------|------|
| Custom-format dump | `/var/www/emdad-sy-3pl-wms/backups/wms_db_staging_pre_perf_norm_20260531.dump` |
| Migration log | `/var/www/emdad-sy-3pl-wms/backups/perf-norm-1-migrate.log` |
| Scripts | `scripts/perf-norm-1-migrate.sql`, `scripts/perf-norm-1-cleanup.sql` |

---

## Rollback procedure

### 1. Stop writers (recommended)

```bash
# Staging backend only — avoid concurrent writes during restore
pm2 stop emdad-wms-backend-staging   # if applicable on this host
```

### 2. Terminate connections

```bash
export PGPASSWORD='…'
psql -h localhost -U wms_user -d postgres -c "
  SELECT pg_terminate_backend(pid)
  FROM pg_stat_activity
  WHERE datname = 'wms_db_staging' AND pid <> pg_backend_pid();
"
```

### 3. Restore database

```bash
export PGPASSWORD='…'
dropdb -h localhost -U wms_user wms_db_staging
createdb -h localhost -U wms_user -O wms_user wms_db_staging
pg_restore -h localhost -U wms_user -d wms_db_staging --no-owner --role=wms_user \
  /var/www/emdad-sy-3pl-wms/backups/wms_db_staging_pre_perf_norm_20260531.dump
```

### 4. Restart application

```bash
pm2 start emdad-wms-backend-staging   # if stopped
```

---

## Post-restore validation checks

Run on `wms_db_staging`:

```sql
SELECT COUNT(*) FROM current_stock;           -- expect 50019
SELECT COUNT(*) FROM warehouses;              -- expect 200
SELECT COUNT(*) FROM current_stock cs
  JOIN warehouses w ON w.id = cs.warehouse_id
 WHERE w.code = 'WH-001';                     -- expect 728
SELECT SUM(quantity_on_hand) FROM current_stock;  -- expect 53827.0000
SELECT COUNT(*) FROM warehouse_tasks;           -- expect 10000
```

---

## Partial rollback

There is **no** incremental undo. If normalization ran without a fresh backup, restore the dump above only.

**Note:** Normalization used autocommit per statement in `psql`. The pre-migration dump is the authoritative rollback point.

---

## Safety

- **Do not** restore `wms_db_staging` dump into production `wms_db`.  
- Production was **not** modified by PERF-NORM-1.
