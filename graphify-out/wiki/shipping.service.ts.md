# shipping.service.ts

> 116 nodes · cohesion 0.04

## Key Concepts

- **shipping.service.ts** (94 connections) — `backend/src/modules/shipping/shipping.service.ts`
- **ShippingService** (54 connections) — `backend/src/modules/shipping/shipping.service.ts`
- **.ensureShipmentForOutbound()** (35 connections) — `backend/src/modules/shipping/shipping.service.ts`
- **BulkShippingService** (22 connections) — `backend/src/modules/shipping/bulk-shipping.service.ts`
- **shipping-error.ts** (22 connections) — `backend/src/modules/shipping/shipping-error.ts`
- **.get()** (22 connections) — `backend/src/modules/shipping/shipping-provider.registry.ts`
- **.assertLiveCarrierSelection()** (15 connections) — `backend/src/modules/shipping/shipping.service.ts`
- **.quoteDestinationRatesUncached()** (15 connections) — `backend/src/modules/shipping/shipping.service.ts`
- **.reshipOutboundWithCarrier()** (14 connections) — `backend/src/modules/shipping/shipping.service.ts`
- **.sendShippingDetails()** (13 connections) — `backend/src/modules/outbound/outbound.service.ts`
- **shipment-parts.util.ts** (12 connections) — `backend/src/modules/shipping/shipment-parts.util.ts`
- **.confirmAndStart()** (11 connections) — `backend/src/modules/shipping/bulk-shipping.service.ts`
- **.has()** (11 connections) — `backend/src/modules/shipping/shipping-provider.registry.ts`
- **.preview()** (10 connections) — `backend/src/modules/shipping/bulk-shipping.service.ts`
- **classifyShippingError()** (10 connections) — `backend/src/modules/shipping/shipping-error.ts`
- **.resolveReceiverCoordinatesFromAddress()** (10 connections) — `backend/src/modules/shipping/shipping.service.ts`
- **quote-freshness.ts** (9 connections) — `backend/src/modules/shipping/quote-freshness.ts`
- **.getConfiguredPickupParty()** (9 connections) — `backend/src/modules/shipping/shipping.service.ts`
- **.processItem()** (8 connections) — `backend/src/modules/shipping/bulk-shipping.service.ts`
- **assertCarrierShippingReady()** (8 connections) — `backend/src/modules/shipping/shipping-config.util.ts`
- **.resolveBabelNeighbourhoodId()** (8 connections) — `backend/src/modules/shipping/shipping.service.ts`
- **ShippingHandoffHookService** (7 connections) — `backend/src/modules/outbound/shipping-handoff-hook.service.ts`
- **.processJob()** (7 connections) — `backend/src/modules/shipping/bulk-shipping.service.ts`
- **parsePhoneForBabel()** (7 connections) — `backend/src/modules/shipping/providers/babel-express/babel-shipment.mapper.ts`
- **shipping-error.unit.spec.ts** (7 connections) — `backend/src/modules/shipping/shipping-error.unit.spec.ts`
- *... and 91 more nodes in this community*

## Relationships

- [withTenantRls](withTenantRls.md) (28 shared connections)
- [shipping-tracking.service.ts](shipping-tracking.service.ts.md) (24 shared connections)
- [ShippingController](ShippingController.md) (22 shared connections)
- [shipping-preflight.ts](shipping-preflight.ts.md) (17 shared connections)
- [shipping.controller.ts](shipping.controller.ts.md) (14 shared connections)
- [EncryptionService](EncryptionService.md) (14 shared connections)
- [bulk-shipping.service.ts](bulk-shipping.service.ts.md) (14 shared connections)
- [babel-express.adapter.ts](babel-express.adapter.ts.md) (10 shared connections)
- [outbound.service.ts](outbound.service.ts.md) (8 shared connections)
- [shipping.module.ts](shipping.module.ts.md) (7 shared connections)
- [@prisma/client](@prisma-client.md) (6 shared connections)
- [RealtimeService](RealtimeService.md) (5 shared connections)

## Source Files

- `backend/src/modules/outbound/outbound.service.ts`
- `backend/src/modules/outbound/shipping-handoff-hook.service.ts`
- `backend/src/modules/shipping/bulk-shipping.service.ts`
- `backend/src/modules/shipping/providers/babel-express/babel-shipment.mapper.ts`
- `backend/src/modules/shipping/quote-freshness.ts`
- `backend/src/modules/shipping/quote-freshness.unit.spec.ts`
- `backend/src/modules/shipping/shipment-parts.util.ts`
- `backend/src/modules/shipping/shipping-carrier-resolver.ts`
- `backend/src/modules/shipping/shipping-cartons.types.ts`
- `backend/src/modules/shipping/shipping-config.util.ts`
- `backend/src/modules/shipping/shipping-error.ts`
- `backend/src/modules/shipping/shipping-error.unit.spec.ts`
- `backend/src/modules/shipping/shipping-geo.service.ts`
- `backend/src/modules/shipping/shipping-provider.interface.ts`
- `backend/src/modules/shipping/shipping-provider.registry.ts`
- `backend/src/modules/shipping/shipping.service.ts`
- `backend/src/modules/shipping/shipping.service.unit.spec.ts`

## Audit Trail

- EXTRACTED: 380 (82%)
- INFERRED: 85 (18%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*