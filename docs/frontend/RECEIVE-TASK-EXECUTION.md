# Receive task execution — UX refactor

## Overview

The receiving task screen (`/tasks/:id` when `taskType === 'receiving'`) was refactored from a generic admin-style table into an operational, scan-first warehouse execution workflow. Implementation lives under `frontend/src/pages/tasks/receiving/`.

## Implemented workflow

1. **Task header** — Inbound order number (link to order detail on desktop), client/company, receiving dock (from staging location), assigned worker, expected arrival, order notes, task status, and SLA hint when arrival is past due.
2. **Summary cards** — Live totals: SKUs, expected/received/damaged/remaining quantities, completion %.
3. **Scan-first section** — Large autofocus scan field, Apply button, camera scanner modal; barcode/SKU match increments received qty and highlights the line; duplicate scan debounce (~1.5s).
4. **Execution lines** — Mobile card layout; desktop table with SKU, barcode, lot, expected/received/damaged/missing, status badge, notes.
5. **First-inbound attribute validation** — For products with no prior lots, no on-hand stock, and no prior completed inbound receipt, workers must confirm physical dimensions/weight against system registration before complete.
6. **Validation banners** — Warnings for shortages, overages, and pending attribute validation.
7. **Actions** — Save progress (`PATCH /tasks/:id/progress` with `receiving_draft`), report issue (saved in draft + banner), complete receiving (existing `POST /tasks/:id/complete` payload).

## UX improvements

- Mobile-first cards and sticky bottom action bar (safe-area aware).
- Emerald scan zone aligned with EMDAD operational theme.
- Line highlight on successful scan.
- Status chips per line: pending, in progress, complete, short, overage, damage noted.
- Receiving-specific header replaces generic page title while executing.

## Validation flow

| Check | Behavior |
|--------|----------|
| Shortage | `received + damaged < expected` → warning; `allow_short_close` on complete |
| Overage | `received > expected` → warning (backend may reject without short-close) |
| Damage | `damaged_qty` encoded in `discrepancy_notes` as `damaged:N` |
| First inbound | Attribute card must be confirmed before complete |
| Lot-tracked | Still requires expected lot on inbound line (unchanged) |

Complete payload remains compatible with `completeReceivingSchema` in `packages/wms-task-execution`.

## Remaining limitations

- **Pause task** — No dedicated backend pause; use Save progress and leave the task in `in_progress`.
- **Supplier/carrier** — Not modeled on inbound orders; shown via order notes only.
- **Task priority** — Warehouse task priority not exposed on task detail API yet; SLA uses expected arrival only.
- **Attribute updates** — Workers confirm match; measured values are stored in draft but do not auto-update product master (admin product edit still required for corrections).
- **Damaged quantity** — Recorded in notes/draft; backend receives good qty in `received_qty` only (damage tracked via discrepancy text).
- **Print worksheet** — Removed from main flow; can be re-added as secondary action if needed.

## Future recommendations

- Add `carrier` / `supplier` / `dock` fields on inbound orders and surface in header.
- Expose `priority` and SLA deadline on task detail for urgency badges.
- Backend support for `damaged_qty` per line on receiving complete.
- Persist attribute validation as audit events and optional product dimension update API for supervisors.
- Hardware scanner wedge: scan field already supports Enter-to-apply.
- Offline draft sync for poor warehouse connectivity.
