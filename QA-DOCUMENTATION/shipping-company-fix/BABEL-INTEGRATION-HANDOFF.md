# Babel Integration Handoff Report

**Environment:** Staging only (`emdad-wms-backend-staging`, port 3001)  
**Date:** 2026-08-21 / 2026-08-22  
**Production:** Untouched

---

## A. Root cause

The system treated Babel `calculatePrice` success (including **price 0 + shipping 0**) as “available,” then called `createShipment` with a different effective meaning of “supported.”

Live proof for `برج الساما` (neighbourhood id **2220**, pin used by `OUT-2026-00376`):

| Step | Result |
|------|--------|
| `findNeighbourhoodByCoordinates` | id 2220 |
| `calculatePrice` hub | `{ price:0, details:{ pickup:0, dropoff:0, shipping:0 } }` |
| `createShipment` | `Cannot ship this shipment with the selected options` |

Control (المالكي id **12**): positive prices; `createShipment` succeeds (AWB created then deleted in diagnostics).

**Mismatch:** UI/availability claimed Babel was OK before the create payload was proven shippable for that neighbourhood + options.

---

## B. Babel contract discovered

See also [`backend/src/modules/shipping/providers/babel-express/BABEL_API.md`](../../backend/src/modules/shipping/providers/babel-express/BABEL_API.md).

- Base: `https://www.babel-express.com/api/v1/webservice.php`
- Geo: `getCities` → `getAreas(cityID)` → `getNeighbourhoods(areaID)`; map via `findNeighbourhoodByCoordinates`
- Quote/create identity: **neighbourhood id**
- Parts: `[{ weight }]` only (no L/W/H in OpenAPI)
- Shippability helper: `isBabelCalculatePriceShippable` — **not** blanket `price===0`

Snapshot after sync (staging): **10 cities / 218 areas / 5421 neighbourhoods** via `POST /api/shipping/babel/geo/sync` (refreshable; not sacred).

---

## C. Code path

```
OMS address (hierarchy ± optional map)
→ optional babel_neighbourhood_id
→ Outbound copy (copyShippingFieldsFromOms)
→ Shipping Details (prefill weight/type; rates with neighbourhood id)
→ calculatePrice (same id + hub pickup)
→ shippable filter
→ Send → preflight calculatePrice → createShipment
→ carrier_shipments + AWB
```

---

## D. Code / data changes (high level)

| Area | Change |
|------|--------|
| Schema | `babel_neighbourhood_id` on OMS/Outbound; `babel_cities` / `babel_areas` / `babel_neighbourhoods` |
| Quote util | Shape-based shippability (documented) |
| Adapter | Quote/create by neighbourhood id; multi-parts; preflight; service options helper |
| Geo sync | `BabelGeoSyncService` + admin sync/list endpoints; client resolve-neighbourhood |
| Parts | `shipment-parts.util` expands qty → physical parts → Babel weights |
| OMS UI | Map **optional** (client + admin create/modal) |
| Shipping UI | Defaults box/hub; rates with neighbourhood id; carrier cards keep visible |
| COD | USD passthrough (prior fix retained) |

**Schema note (user feedback):** Only **`babelNeighbourhoodId`** on orders — not city/area IDs on OMS.

---

## E. Tests performed

| Test | Expected | Actual |
|------|----------|--------|
| Unit: shippable util | Zeroed hub unshippable; positive hub OK; price0+shipping>0 OK | PASS |
| Unit: mapper multi-parts + COD USD | PASS | PASS |
| Unit: shipping service | PASS | PASS |
| Live quote برج الساما hub | No available quote; error message | `quotes:[]` + non-shippable error |
| Live quote المالكي id 12 hub | Available ~10000 SYP | `price:10000 SYP` |
| Geo sync | Snapshot populated | 10/218/5421 |
| Multi-part createShipment (2×1kg) hub id 12 | Success AWB then delete | Success |
| Retry OUT-2026-00376 with hood 2220 | Fail honestly (not fake success) | Failed with Babel/preflight message |
| Full Client→Admin pick/pack E2E | Required by plan | **Not fully re-run in this session** — remaining |
| Map-optional OMS create browser | Required | Code change done; browser E2E remaining |

---

## F. Evidence summary

- Unshippable destination no longer surfaces as free **SYP 0** available card via rates API.
- Shippable Damascus neighbourhood returns real Babel price.
- Snapshot refresh works after fixing transaction timeout (HTTP outside TX).

---

## G. Remaining uncertainty / follow-ups

1. Full Client Portal → Approve → Pick → Pack → Send E2E with supported destination (browser).
2. Persist `babelNeighbourhoodId` automatically on OMS create when map pin resolves (API exists; wire UI save of id on pin select).
3. Shipping Details UI: richer per-part L/W/H list + explicit dual address/hub option picker (backend `getServiceOptions` ready; UI still uses delivery-type select + rates).
4. ~~Dedup matching of internal Syria hierarchy ↔ Babel~~ — local hierarchy now merges Babel names; `BabelAddressAdapter` maps unified names → neighbourhood id at quote/send.
5. Legitimate free shipping (`price===0` with non-zero shipping) never observed live — rule allows it; monitor if Babel ever returns it.
6. Refresh path: `POST /api/shipping/babel/geo/sync` then `node shared/syria-locations/merge-babel-into-syria-hierarchy.mjs` + frontend rebuild when Babel coverage changes.

---

## User-feedback alignment

1. **No blanket price=0 unavailable** — shape-based helper + docs/tests.  
2. **Only neighbourhood id on OMS** — city/area live in snapshot tables only.  
3. **Snapshot refreshable** — `POST /api/shipping/babel/geo/sync` + meta endpoint.
