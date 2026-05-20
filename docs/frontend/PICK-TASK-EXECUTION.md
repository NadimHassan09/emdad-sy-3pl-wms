# Pick task execution — UX refactor

## Overview

The pick task screen (`/tasks/:id` when `taskType === 'pick'`) was refactored from a static allocation table into an operational, scan-first outbound picking workflow. Implementation lives under `frontend/src/pages/tasks/pick/`.

## Implemented workflow

1. **Task header** — Outbound order number (link on desktop), client/company, picker, carrier, ship-by date, warehouse, task status, SLA hint when ship date is past due.
2. **Summary cards** — SKUs, units, completed/remaining picks, unique bin count, completion %.
3. **Next bin guidance** — Highlights the next incomplete pick location (route sorted by `fullPath`).
4. **Packing drop-off** — Select or scan packing staging location (saved in draft; paperwork / handoff to pack task).
5. **Focus mode (default)** — One reservation line at a time:
   - Scan source bin → scan product → confirm quantity (stepper + scan).
   - Large location hero with aisle/rack/shelf segments.
6. **Pick execution table** — SKU, product, barcode, source bin, lot, required/picked/remaining, scan state, status.
7. **Actions** — Save progress (`pick_draft` via `PATCH /tasks/:id/progress`), report exception (line notes + short flag), complete picking.

## Warehouse execution logic

| Step | Worker action | Validation |
|------|----------------|------------|
| 1 | Scan bin | Must match reserved `locationId` (FEFO/FIFO allocation) |
| 2 | Scan product | SKU or barcode must match outbound line product |
| 3 | Confirm quantity | `pickedQty` vs `requiredQty`; short picks flagged |
| 4 | Complete | All lines `complete`; payload echoes reservations exactly |

Reservations come from `execution_state.reservations` after task **Start** (backend allocates inventory). Lines are sorted by location path to reduce walking.

Complete payload uses `buildPickCompletePayload()` and must match reserved slices exactly (`completePickSchema` / `assertPickCompletionMatchesReservations` on the server).

## Validation flow

| Check | Behavior |
|--------|----------|
| Wrong bin | Error feedback with expected bin short label |
| Wrong product | Error if scan does not match line SKU/barcode |
| Short pick | Status `short`; blocks complete until resolved |
| Damaged | Flags line via exception; blocks complete until cleared |
| Incomplete scans | Warning banner; complete disabled |
| Open lines | Count shown in validation alert |

## Operational UX improvements

- Mobile sticky action bar (save / exception / complete).
- Emerald scan zone with autofocus and camera modal.
- Completed lines can collapse when advancing in focus mode.
- Desktop table visible below focus panel on `md+`.
- Generic page header hidden during active pick execution.

## Remaining limitations

- **Pause picking** — No dedicated pause API; use Save progress.
- **Partial pick complete** — Backend requires full reservation quantities on complete; shorts must be resolved via manager workflow (`blocked` / `approve_partial`), not partial complete payload.
- **Pick path optimization** — Sort is lexical by `fullPath`, not true distance-based routing.
- **Packing destination** — Stored in draft only; not sent on pick complete API.
- **Shipment priority** — Not on outbound order model; SLA uses `requiredShipDate` only.
- **Print pick list** — Removed from main flow; can be re-added as secondary action.
- **HU / serial / batch camera overlay** — Not implemented; wedge scanner + camera modal supported.

## Future recommendations

- Backend support for short-pick complete with approval workflow from the execution UI.
- Persist packing destination on task or outbound order for pack handoff.
- Pick sequence API (optimized walk path) instead of lexical sort.
- Serial-tracked product scan step when `trackingType` requires it.
- Restore print worksheet for paper backup picks.
