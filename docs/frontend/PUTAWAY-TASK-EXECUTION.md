# Putaway task execution — UX refactor

## Overview

The putaway task screen (`/tasks/:id` when `taskType` is `putaway` or `putaway_quarantine`) was refactored from a generic destination-picker table into an operational, scan-first inventory movement workflow. Implementation lives under `frontend/src/pages/tasks/putaway/`.

## Implemented workflow

1. **Task header** — Putaway type, inbound order number (link on desktop), client/company, assigned worker, warehouse, staging→storage zone hint, and task status. Generic page header is hidden while the task is active (same pattern as receiving).
2. **Summary cards** — Live totals: SKUs, units to move, completed lines, remaining lines, completion %.
3. **Focus mode (default)** — One movement line at a time with:
   - **Location heroes** — Prominent source (staging) and destination bin with path segments (aisle › rack › shelf style parsing from `fullPath`).
   - **3-step scan wizard** — Source staging location → destination bin → product barcode/SKU.
   - Quantity entry, destination combobox fallback, split quantity, previous/next line navigation.
   - Completed lines can collapse when advancing.
4. **Full movement table** — Desktop table when not in focus mode; also shown on `md+` below focus panel for supervisors. Columns: product, SKU, source, destination, target qty, moved qty, scan state (S/D/P), status, split.
5. **Mobile line picker** — Compact cards to jump between lines when in focus mode.
6. **Actions** — Save progress (`PATCH /tasks/:id/progress` with `putaway_draft`), report exception (line notes in draft), complete putaway (existing `POST /tasks/:id/complete` payload).

## Movement execution logic

| Step | Worker action | System validation |
|------|----------------|-------------------|
| 1 | Scan staging/source | Must match `source_staging_location_id` on task line |
| 2 | Scan destination bin | Must match an eligible putaway destination from warehouse list |
| 3 | Scan product | SKU or product barcode must match inbound line product |
| 4 | Confirm quantity | Per-row `putaway_quantity`; split rows sum to task line target |
| 5 | Complete | All lines with qty > 0 need destination; quantities sum per `inbound_order_line_id` |

Draft state (`PutawayLineDraft`) tracks `sourceVerified`, `destVerified`, `productVerified`, destination id, quantity, and notes. Progress is restored from `execution_state.putaway_draft` on load.

## Validation flow

| Check | Behavior |
|--------|----------|
| Wrong source scan | Error feedback; staging path shown in message |
| Wrong destination | Error if barcode not in putaway destination list |
| Wrong product | Error if scan does not match line SKU/barcode |
| Partial quantity | Split row; sums validated on complete |
| Incomplete scans | Warning banner when qty > 0 but scans not verified |
| Quantity mismatch | Toast on complete if row sums ≠ task line target |

Complete payload remains compatible with `completePutawaySchema` in `packages/wms-task-execution` (`task_type`, `lines[]` with `inbound_order_line_id`, `putaway_quantity`, `destination_location_id`, `lot_id`).

## Operational improvements

- Scan-first emerald execution zone with autofocus and camera modal.
- Location hierarchy emphasized via `locationDisplay()` path segments and large mono bin labels.
- Sticky bottom action bar on mobile (safe-area aware).
- Focus mode optimized for PDA one-hand flow; table mode for bulk desktop entry.
- Status chips: pending, in progress, ready, complete.
- Validation alert aggregates top issues before complete.

## Remaining limitations

- **Pause / reassign** — No dedicated worker pause API; use Save progress. Reassign remains on task detail admin UI.
- **Task priority & SLA** — Not exposed on task detail; header shows status only.
- **Warehouse zone** — Zone label is static “Staging → storage”; per-line zone from location metadata not surfaced.
- **LPN / HU** — Not modeled on putaway lines; workflow uses staging location + product scan only.
- **Blocked locations** — No backend flag for blocked bins; invalid scan shows generic error.
- **Print worksheet** — Removed from main flow (was on legacy form); can be re-added as secondary action.
- **Product verification** — Encouraged in UI but not required by backend on complete (only destination + quantity enforced server-side).
- **Quarantine putaway** — Same UX; destination list filtered to quarantine-eligible locations (unchanged).

## Future recommendations

- Require all three scan flags (or supervisor override) before complete.
- Surface task priority, SLA deadline, and inbound dock/staging zone in header.
- Add LPN/handling-unit scan step when inventory is palletized.
- Backend blocked-location checks with operational error codes.
- Restore print worksheet for paper backup workflows.
- Auto-advance to next incomplete line after successful product scan.
