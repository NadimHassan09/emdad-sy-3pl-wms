# Babel Express Webservice API (V1)

Source of truth: https://www.babel-express.com/api/v1/documents/webservice/openapi.yaml  
Docs UI: https://www.babel-express.com/api/v1/documents/webservice/index.html

## Authentication

- Mechanism: HTTP Basic Auth (`securitySchemes.basicAuth`)
- Credentials: Babel Express **reseller username** and **password**
- No separate login/token endpoint — every action authenticates with Basic Auth

## Base URL

```
https://www.babel-express.com/api/v1/webservice.php
```

Actions are path suffixes under that base (e.g. `…/webservice.php/createShipment`).

## Endpoints used in V1

| Action | Method | Purpose |
|--------|--------|---------|
| `/getCities` | POST | Connection test (authenticated, empty body OK) |
| `/createShipment` | POST | Create shipment; returns AWB |
| `/calculatePrice` | POST | Quote (adapter only; no V1 Admin UI) |
| `/trackShipment` | POST | Tracking (adapter only) |
| `/getAWBLink` | POST | Printable AWB URL |
| `/getAWBPdf` | POST | Base64 AWB PDF |

Also documented (not required for V1 handoff): `/getAreas`, `/getNeighbourhoods`, `/findNeighbourhoodByCoordinates`, `/findNeighbourhoodByAddress`, `/createReturnShipment`, `/deleteShipment`.

## Create shipment

**Request (required):**

```json
{
  "shipment": {
    "receiver": {
      "name": "…",
      "phone": { "country": "963", "phone": "9xxxxxxxx" },
      "address": "…",
      "neighbourhood": { "coordinates": { "lat": 0, "lng": 0 } }
    },
    "type": "box",
    "parts": [{ "weight": 1.5 }],
    "contents": "…",
    "deliveryType": "address",
    "pickupType": "address",
    "cod": { "amount": 0, "currency": "USD" },
    "payer": "reseller",
    "reference": "OMS-…"
  }
}
```

- `type`: `box` | `envelope` (envelope weight must be 1)
- `deliveryType` / `pickupType`: `address` | `hub`
- `payer`: `sender` | `receiver` | `reseller`
- `neighbourhood`: either `{ "id": <int> }` **or** `{ "coordinates": { "lat", "lng" } }` — V1 uses coordinates only
- `sender` omitted → pickup from reseller primary address (per OpenAPI)
- `cod.amount` = `0` disables COD

**Success response identifier:**

```json
{ "status": "success", "awb": "2300456789" }
```

Store `awb` as the external shipment / tracking identifier.

## Quote (`/calculatePrice`)

Returns `{ status, price, currency, details: { pickup, dropoff, shipping } }`.  
Implemented on the adapter for future use; **not** exposed in V1 UI.

## Errors

```json
{ "status": "error", "errorMessage": "…" }
```

Surface `errorMessage` to Admins; never log or return credentials.
