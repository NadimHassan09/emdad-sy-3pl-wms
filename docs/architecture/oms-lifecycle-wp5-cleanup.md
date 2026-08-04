# OMS Lifecycle WP5 Cleanup Notes

**Date:** 2026-08-03  
**Scope:** staging only

## Removed / disabled parallel workflows

- OMS status no longer mirrors WMS picking/packing/shipped (sync → OFD only).
- Legacy OMS COD collect/settle endpoints throw and direct clients to `/cod/*`.
- Direct `POST .../returned` and `POST .../complete` on OMS orders rejected (Delivered is terminal; use OMS Returns).
- Admin create provisions outbound atomically → Pending.
- Approve sets Pending (idempotent); reject → Cancelled.

## Data migration

- Backup table: `oms_status_migration_backup`
- Remap: warehouse-mirrored statuses → `pending`; `completed` → `delivered`; `rejected` → `cancelled`
- New tables: `cod_records`, `cod_adjustments`, `oms_returns`, `oms_return_lines`

## Remaining legacy enum values

`OmsOrderStatus` still contains warehouse-era values in the Postgres enum for safe rollback until a future production cutover migration drops unused values. Writers no longer emit them (except historical rows already remapped).
