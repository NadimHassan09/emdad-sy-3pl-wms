# Babel Express Webservice API (V1)

Source of truth: https://www.babel-express.com/api/v1/documents/webservice/openapi.yaml  
Docs UI: https://www.babel-express.com/api/v1/documents/webservice/index.html  
Portal (UX reference): https://www.babel-express.com/ship

## Authentication

- Mechanism: HTTP Basic Auth (`securitySchemes.basicAuth`)
- Credentials: Babel Express **reseller username** and **password**
- No separate login/token endpoint — every action authenticates with Basic Auth

## Base URL

```
https://www.babel-express.com/api/v1/webservice.php
```

## Geographic hierarchy (Babel)

| Portal label | API | Parameter |
|--------------|-----|-----------|
| محافظة / city list | `POST /getCities` | — |
| المدينة / المنطقة | `POST /getAreas` | `cityID` |
| البلدة / الحي | `POST /getNeighbourhoods` | `areaID` |
| Map resolve | `POST /findNeighbourhoodByCoordinates` | `{ coordinates: { lat, lng } }` |

**Shipment identity for quote/create:** Babel **neighbourhood id** (not display names).

Internal snapshot tables (`babel_cities` / `babel_areas` / `babel_neighbourhoods`) are a **refreshable copy** via `POST /api/shipping/babel/geo/sync` — not eternal truth.

OMS/Outbound stores only `babel_neighbourhood_id` (nullable). City/area stay in the snapshot tables.

## Quote shippability (critical)

Do **not** use a blanket `price === 0 ⇒ unavailable`.

`isBabelCalculatePriceShippable` marks unshippable when Babel’s **response shape** indicates no service:

1. Address delivery with `details.dropoff === null`, or
2. `details.shipping === 0` **and** `price === 0` (zeroed fee breakdown that still returns `status:success` but `createShipment` rejects — e.g. برج الساما).

If `price === 0` but `shipping > 0`, treat as potentially legitimate free/promo and allow.

## Create shipment

Required: receiver (with neighbourhood id or coordinates), `type` box|envelope, `parts[{weight}]`, contents, deliveryType, pickupType, cod, payer.

- Multi-part: one `{ weight }` per physical unit (OpenAPI has **no** L/W/H on parts).
- Reseller warehouse: `pickupType` coerced to `hub` (no sender block).
- Shipping fee payer: `sender` coerced to `receiver` (Babel rejects sender; EMDAD bills the receiver).
- Preflight `calculatePrice` for the selected option before `createShipment`.

## COD

`cod.amount = 0` disables COD. Currency should match EMDAD business currency (USD) when COD is USD — do not force SYP.
