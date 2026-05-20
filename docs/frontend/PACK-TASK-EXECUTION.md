# Pack task execution — UX refactor

## Overview

The pack task screen (`/tasks/:id` when `taskType === 'pack'`) was refactored from a simple quantity table into an operational, shipment-focused packing workflow. Implementation lives under `frontend/src/pages/tasks/pack/`.

## Implemented workflow

1. **Task header** — Outbound order (link on desktop), client, destination, packer, carrier, ship-by date, warehouse, task status, SLA when overdue.
2. **Summary cards** — SKUs, picked units, packed units, remaining, package count, completion %.
3. **Packing station** — Select packing location from warehouse packing-type bins (saved in draft).
4. **Pick verification** — Per-line picked qty, damaged qty entry, verification checkbox before packing unlocks.
5. **Package management** — Create multiple packages (`PKG-001`, …), select active package, finalize, weight/dimensions, print label (browser print).
6. **Scan-first packing** — After verification: scan product (+1 to active package) or scan package label to switch active carton.
7. **Packing table** — SKU, product, barcode, picked/packed/remaining, package assignment hint, status badges.
8. **Actions** — Save progress (`pack_draft`), report issue, complete packing.

## Package management logic

Packages are **UI/draft constructs** — the backend `completePackSchema` accepts per-line `packed_qty` and optional `package_label` (one label per outbound line, chosen from the package with the largest quantity for that line).

| Concept | Behavior |
|---------|----------|
| Create package | Adds open package with auto label |
| Active package | Scan target for product +1 increments |
| Items | `{ outboundOrderLineId, quantity }[]` per package |
| Finalize | Locks package; prompts new package if needed |
| Line `packedQty` | Sum of quantities across all packages |

## Validation flow

| Check | Behavior |
|--------|----------|
| Verification gate | Packing scans disabled until “Verification complete” |
| Overpack | Packed total &gt; picked → blocked on complete |
| Short pack | Missing units after verification → warning |
| Open packages | Non-empty open packages must be finalized |
| Incomplete lines | All lines must reach `complete` status |
| Backend | `packed_qty` cannot exceed `pickedQuantity` per line |

Complete uses `buildPackCompletePayload()` compatible with `POST /tasks/:id/complete`.

## Operational UX improvements

- Two-column layout: execution + package sidebar on desktop.
- Emerald scan zone after verification.
- Mobile sticky actions (save / issue / complete).
- Generic page header hidden during active pack execution.
- Progress cards update as items are scanned into packages.

## Remaining limitations

- **Pause packing** — No pause API; use Save progress.
- **Package persistence** — Packages exist in `pack_draft` only; not stored as first-class entities on the server.
- **Multi-package per line on complete** — API allows one `package_label` per line; split shipments use the dominant package label only.
- **Carrier labels / rates** — No carrier API integration; print label is a simple browser template.
- **Weight/dimensions** — Captured in draft only; not sent on pack complete.
- **Shipment priority** — Not on outbound model; SLA uses `requiredShipDate` only.
- **Print pack list** — Legacy worksheet removed from main flow; per-package print label only.

## Future recommendations

- Backend package entities with LPN, weight, dims, and label PDF generation.
- Send package metadata on complete or via separate shipment API.
- Scan package LPN barcode on create (not just label text).
- Allow multiple `package_label` entries or child rows for split cartons per line.
- Integrate carrier rate shopping and label purchase (ShipHero-style).
