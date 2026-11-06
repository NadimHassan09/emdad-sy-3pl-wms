# sila-sy.adapter.ts

> 92 nodes · cohesion 0.05

## Key Concepts

- **sila-sy.adapter.ts** (82 connections) — `backend/src/modules/shipping/providers/sila-sy/sila-sy.adapter.ts`
- **ShippingCredentials** (65 connections) — `backend/src/modules/shipping/shipping-provider.interface.ts`
- **SilaSyAdapter** (34 connections) — `backend/src/modules/shipping/providers/sila-sy/sila-sy.adapter.ts`
- **.createShipment()** (19 connections) — `backend/src/modules/shipping/providers/sila-sy/sila-sy.adapter.ts`
- **apiKey()** (17 connections) — `backend/src/modules/shipping/providers/sila-sy/sila-sy.adapter.ts`
- **.getTrackingHistory()** (16 connections) — `backend/src/modules/shipping/providers/sila-sy/sila-sy.adapter.ts`
- **sila-sy.http-client.ts** (14 connections) — `backend/src/modules/shipping/providers/sila-sy/sila-sy.http-client.ts`
- **firstNonEmptyString()** (12 connections) — `backend/src/modules/shipping/providers/sila-sy/sila-sy.adapter.ts`
- **SilaSyHttpClient** (11 connections) — `backend/src/modules/shipping/providers/sila-sy/sila-sy.http-client.ts`
- **sila-area.util.ts** (10 connections) — `backend/src/modules/shipping/providers/sila-sy/sila-area.util.ts`
- **.getServiceOptions()** (10 connections) — `backend/src/modules/shipping/providers/sila-sy/sila-sy.adapter.ts`
- **.narrowProvinceArea()** (10 connections) — `backend/src/modules/shipping/providers/sila-sy/sila-sy.adapter.ts`
- **sila-sy.adapter.unit.spec.ts** (10 connections) — `backend/src/modules/shipping/providers/sila-sy/sila-sy.adapter.unit.spec.ts`
- **pickSilaChildArea()** (9 connections) — `backend/src/modules/shipping/providers/sila-sy/sila-area.util.ts`
- **.fetchCargo()** (9 connections) — `backend/src/modules/shipping/providers/sila-sy/sila-sy.adapter.ts`
- **.pollTracking()** (9 connections) — `backend/src/modules/shipping/providers/sila-sy/sila-sy.adapter.ts`
- **SilaSyApiError** (9 connections) — `backend/src/modules/shipping/providers/sila-sy/sila-sy.http-client.ts`
- **mapSilaStatus()** (8 connections) — `backend/src/modules/shipping/providers/sila-sy/sila-sy.adapter.ts`
- **.findShipmentByReference()** (8 connections) — `backend/src/modules/shipping/providers/sila-sy/sila-sy.adapter.ts`
- **.resolveDuplicateReference()** (8 connections) — `backend/src/modules/shipping/providers/sila-sy/sila-sy.adapter.ts`
- **.request()** (8 connections) — `backend/src/modules/shipping/providers/sila-sy/sila-sy.http-client.ts`
- **buildSilaTimelineEvents()** (7 connections) — `backend/src/modules/shipping/providers/sila-sy/sila-sy.adapter.ts`
- **.cancelShipment()** (7 connections) — `backend/src/modules/shipping/providers/sila-sy/sila-sy.adapter.ts`
- **.getQuote()** (6 connections) — `backend/src/modules/shipping/providers/sila-sy/sila-sy.adapter.ts`
- **.normalizeWebhook()** (6 connections) — `backend/src/modules/shipping/providers/sila-sy/sila-sy.adapter.ts`
- *... and 67 more nodes in this community*

## Relationships

- [shipping.module.ts](shipping.module.ts.md) (44 shared connections)
- [babel-express.adapter.ts](babel-express.adapter.ts.md) (27 shared connections)
- [shipping-tracking.service.ts](shipping-tracking.service.ts.md) (27 shared connections)
- [sila-webhook.util.ts](sila-webhook.util.ts.md) (9 shared connections)
- [oms-waybill.service.ts](oms-waybill.service.ts.md) (8 shared connections)
- [geo-polygon.util.ts](geo-polygon.util.ts.md) (6 shared connections)
- [@nestjs/common](@nestjs-common.md) (3 shared connections)
- [shipping-preflight.ts](shipping-preflight.ts.md) (2 shared connections)
- [ShippingProvider](ShippingProvider.md) (2 shared connections)
- [EncryptionService](EncryptionService.md) (1 shared connections)
- [shipping.controller.ts](shipping.controller.ts.md) (1 shared connections)
- [ShippingController](ShippingController.md) (1 shared connections)

## Source Files

- `backend/src/modules/shipping/providers/babel-express/babel-express.adapter.ts`
- `backend/src/modules/shipping/providers/sila-sy/sila-area.util.ts`
- `backend/src/modules/shipping/providers/sila-sy/sila-area.util.unit.spec.ts`
- `backend/src/modules/shipping/providers/sila-sy/sila-sy.adapter.ts`
- `backend/src/modules/shipping/providers/sila-sy/sila-sy.adapter.unit.spec.ts`
- `backend/src/modules/shipping/providers/sila-sy/sila-sy.http-client.ts`
- `backend/src/modules/shipping/shipping-provider.interface.ts`
- `backend/src/modules/shipping/sila-event-sync.service.ts`

## Audit Trail

- EXTRACTED: 352 (99%)
- INFERRED: 5 (1%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*