# Dispatch task execution — UX refactor

## Overview

The dispatch task screen (`/tasks/:id` when `taskType === 'dispatch'`) was refactored into a shipment dispatch and carrier handoff workflow. Implementation lives under `frontend/src/pages/tasks/dispatch/`.

The operational focus is **movement from packing (source) to dispatch dock (destination)** with scan validation before carrier handoff.

## Implemented workflow

1. **Task header** — Outbound order, client, destination address, dispatcher, carrier, ship-by date, warehouse, status, SLA hint.
2. **Readiness badge** — `awaiting` → `partial` → `ready` (or `blocked`).
3. **Summary cards** — SKUs, units, package count, packages scanned, total weight (draft), progress %.
4. **Movement path** — Visual **Source (packing)** → **Destination (dispatch dock)** with location hierarchy labels.
5. **Location confirmation** — Combobox + scan for:
   - **Source:** `packing` location type (packing area / station)
   - **Destination:** `output` location type (shipping dock per design system)
6. **Scan wizard** — Source → Destination → Package label (each carton/LPN).
7. **Packages** — List with weight, scanned/loaded state; seeded from completed **pack** task `pack_draft` when available.
8. **Shipment verification** — Per-line picked vs ship qty, verify checkbox.
9. **Carrier handoff** — Carrier, tracking, driver, vehicle, dispatch notes.
10. **Actions** — Save progress (`dispatch_draft`), report issue, print documents, complete dispatch.

## Movement & validation logic

| Step | Worker action | Validation |
|------|----------------|------------|
| 1 | Select/scan **packing** location | Must match a warehouse `packing` type location |
| 2 | Select/scan **dispatch dock** | Must match a warehouse `output` type location |
| 3 | Scan each **package label** | Label must exist on shipment package list |
| 4 | Verify lines + ship qty | `ship_qty` ≤ `pickedQuantity`; all lines verified |
| 5 | Complete | Payload via `completeDispatchSchema` |

Draft state is stored in `execution_state.dispatch_draft` via `PATCH /tasks/:id/progress`.

Complete API (unchanged):

```json
{
  "task_type": "dispatch",
  "lines": [{ "outbound_order_line_id": "...", "ship_qty": "..." }],
  "carrier": "...",
  "tracking": "..."
}
```

Server handler deducts inventory from pick reservations and marks outbound `shipped`.

## Operational UX improvements

- Movement path hero (packing → dock) matches warehouse mental model.
- Scan-first with emerald execution zone and camera modal.
- Readiness badge and warning banner for incomplete steps.
- Packages pre-loaded from pack task when sibling pack task is completed in same workflow.
- Mobile sticky action bar.
- Generic page header hidden during active dispatch execution.

## Remaining limitations

- **Source/destination on complete** — Location IDs are draft-only; not sent on dispatch complete (no API fields yet).
- **Package entities** — Packages are UI draft; backend does not persist package weights/dimensions on dispatch.
- **Carrier integration** — No rate shop or label purchase; print is a simple browser template.
- **Pause dispatch** — Use Save progress only.
- **Duplicate dispatch** — Not blocked server-side from UI alone.
- **Pack skip** — If pack was skipped, packages default to `PKG-001` unless worker adds more.

## Future recommendations

- Extend `completeDispatchSchema` with `source_location_id` and `destination_location_id` for audit trail.
- Persist package LPNs and weights on outbound shipment records.
- Gate scan at dispatch dock with geofence or dock assignment.
- Integrate carrier APIs for labels and tracking validation.
