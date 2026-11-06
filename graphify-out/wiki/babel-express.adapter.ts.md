# babel-express.adapter.ts

> 63 nodes · cohesion 0.07

## Key Concepts

- **babel-express.adapter.ts** (49 connections) — `backend/src/modules/shipping/providers/babel-express/babel-express.adapter.ts`
- **BabelExpressAdapter** (30 connections) — `backend/src/modules/shipping/providers/babel-express/babel-express.adapter.ts`
- **babel-shipment.mapper.ts** (25 connections) — `backend/src/modules/shipping/providers/babel-express/babel-shipment.mapper.ts`
- **babel-geo-sync.service.ts** (16 connections) — `backend/src/modules/shipping/providers/babel-express/babel-geo-sync.service.ts`
- **ShippingQuoteInput** (15 connections) — `backend/src/modules/shipping/shipping-provider.interface.ts`
- **ShippingQuoteResult** (15 connections) — `backend/src/modules/shipping/shipping-provider.interface.ts`
- **mapCreateShipmentPayload()** (14 connections) — `backend/src/modules/shipping/providers/babel-express/babel-shipment.mapper.ts`
- **.createShipment()** (13 connections) — `backend/src/modules/shipping/providers/babel-express/babel-express.adapter.ts`
- **babel-express.http-client.ts** (13 connections) — `backend/src/modules/shipping/providers/babel-express/babel-express.http-client.ts`
- **.getQuote()** (12 connections) — `backend/src/modules/shipping/providers/babel-express/babel-express.adapter.ts`
- **BabelExpressHttpClient** (11 connections) — `backend/src/modules/shipping/providers/babel-express/babel-express.http-client.ts`
- **provider-request-log.ts** (10 connections) — `backend/src/modules/shipping/provider-request-log.ts`
- **BabelApiError** (9 connections) — `backend/src/modules/shipping/providers/babel-express/babel-express.http-client.ts`
- **isBabelCalculatePriceShippable()** (8 connections) — `backend/src/modules/shipping/providers/babel-express/babel-quote.util.ts`
- **mapCalculatePricePayload()** (7 connections) — `backend/src/modules/shipping/providers/babel-express/babel-shipment.mapper.ts`
- **resolveBabelCodCurrency()** (7 connections) — `backend/src/modules/shipping/providers/babel-express/babel-shipment.mapper.ts`
- **resolveBabelPickupType()** (7 connections) — `backend/src/modules/shipping/providers/babel-express/babel-shipment.mapper.ts`
- **babel-webhook.unit.spec.ts** (7 connections) — `backend/src/modules/shipping/providers/babel-express/babel-webhook.unit.spec.ts`
- **.getServiceOptions()** (7 connections) — `backend/src/modules/shipping/providers/sena-express/sena-express.adapter.ts`
- **shipping-provider.registry.unit.spec.ts** (7 connections) — `backend/src/modules/shipping/shipping-provider.registry.unit.spec.ts`
- **sanitizeBabelCreatePayload()** (6 connections) — `backend/src/modules/shipping/provider-request-log.ts`
- **.getServiceOptions()** (6 connections) — `backend/src/modules/shipping/providers/babel-express/babel-express.adapter.ts`
- **babel-quote.util.ts** (6 connections) — `backend/src/modules/shipping/providers/babel-express/babel-quote.util.ts`
- **.getQuote()** (6 connections) — `backend/src/modules/shipping/providers/sena-express/sena-express.adapter.ts`
- **logSanitizedProviderRequest()** (5 connections) — `backend/src/modules/shipping/provider-request-log.ts`
- *... and 38 more nodes in this community*

## Relationships

- [shipping.module.ts](shipping.module.ts.md) (33 shared connections)
- [sila-sy.adapter.ts](sila-sy.adapter.ts.md) (27 shared connections)
- [shipping-tracking.service.ts](shipping-tracking.service.ts.md) (19 shared connections)
- [shipping.service.ts](shipping.service.ts.md) (10 shared connections)
- [shipping.controller.ts](shipping.controller.ts.md) (7 shared connections)
- [shipping-preflight.ts](shipping-preflight.ts.md) (6 shared connections)
- [EncryptionService](EncryptionService.md) (5 shared connections)
- [@nestjs/common](@nestjs-common.md) (4 shared connections)
- [@prisma/client](@prisma-client.md) (4 shared connections)
- [withTenantRls](withTenantRls.md) (4 shared connections)
- [sila-webhook.util.ts](sila-webhook.util.ts.md) (3 shared connections)
- [ShippingProvider](ShippingProvider.md) (2 shared connections)

## Source Files

- `backend/src/modules/shipping/provider-request-log.ts`
- `backend/src/modules/shipping/provider-request-log.unit.spec.ts`
- `backend/src/modules/shipping/providers/babel-express/babel-express.adapter.ts`
- `backend/src/modules/shipping/providers/babel-express/babel-express.http-client.ts`
- `backend/src/modules/shipping/providers/babel-express/babel-geo-sync.service.ts`
- `backend/src/modules/shipping/providers/babel-express/babel-quote.util.ts`
- `backend/src/modules/shipping/providers/babel-express/babel-quote.util.unit.spec.ts`
- `backend/src/modules/shipping/providers/babel-express/babel-shipment.mapper.ts`
- `backend/src/modules/shipping/providers/babel-express/babel-shipment.mapper.unit.spec.ts`
- `backend/src/modules/shipping/providers/babel-express/babel-tracking.unit.spec.ts`
- `backend/src/modules/shipping/providers/babel-express/babel-webhook.unit.spec.ts`
- `backend/src/modules/shipping/providers/sena-express/sena-express.adapter.ts`
- `backend/src/modules/shipping/shipping-provider.interface.ts`
- `backend/src/modules/shipping/shipping-provider.registry.unit.spec.ts`

## Audit Trail

- EXTRACTED: 269 (99%)
- INFERRED: 2 (1%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*