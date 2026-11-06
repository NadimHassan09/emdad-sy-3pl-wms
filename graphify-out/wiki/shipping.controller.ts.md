# shipping.controller.ts

> 94 nodes · cohesion 0.03

## Key Concepts

- **shipping.controller.ts** (63 connections) — `backend/src/modules/shipping/shipping.controller.ts`
- **client-shipping.controller.ts** (27 connections) — `backend/src/modules/client-portal/shipping/client-shipping.controller.ts`
- **address-resolve.service.ts** (25 connections) — `backend/src/modules/shipping/address-resolve.service.ts`
- **AddressResolveService** (22 connections) — `backend/src/modules/shipping/address-resolve.service.ts`
- **QuoteShippingRatesDto** (15 connections) — `backend/src/modules/shipping/dto/quote-shipping-rates.dto.ts`
- **ClientShippingController** (11 connections) — `backend/src/modules/client-portal/shipping/client-shipping.controller.ts`
- **.resolveFromAddress()** (11 connections) — `backend/src/modules/shipping/address-resolve.service.ts`
- **ResolveAddressFromPinDto** (9 connections) — `backend/src/modules/shipping/dto/resolve-address-from-pin.dto.ts`
- **UpsertShippingOriginAddressDto** (9 connections) — `backend/src/modules/shipping/dto/upsert-shipping-origin-address.dto.ts`
- **ConnectShippingProviderDto** (7 connections) — `backend/src/modules/shipping/dto/connect-shipping-provider.dto.ts`
- **RegisterShippingWebhookDto** (7 connections) — `backend/src/modules/shipping/dto/register-shipping-webhook.dto.ts`
- **ResolveAddressFromNamesDto** (7 connections) — `backend/src/modules/shipping/dto/resolve-address-from-names.dto.ts`
- **.constructor()** (6 connections) — `backend/src/modules/client-portal/shipping/client-shipping.controller.ts`
- **.resolveAddressFromNames()** (5 connections) — `backend/src/modules/client-portal/shipping/client-shipping.controller.ts`
- **.resolveAddressFromPin()** (5 connections) — `backend/src/modules/client-portal/shipping/client-shipping.controller.ts`
- **.resolveNeighbourhood()** (5 connections) — `backend/src/modules/client-portal/shipping/client-shipping.controller.ts`
- **.resolveTownAcrossDistricts()** (5 connections) — `backend/src/modules/shipping/address-resolve.service.ts`
- **location-match.ts** (5 connections) — `backend/src/modules/shipping/location-match.ts`
- **matchIndexedTown()** (5 connections) — `backend/src/modules/shipping/location-match.ts`
- **.getBoundary()** (4 connections) — `backend/src/modules/client-portal/shipping/client-shipping.controller.ts`
- **.buildHierarchyCoordinateIndex()** (4 connections) — `backend/src/modules/shipping/address-resolve.service.ts`
- **.resolveFromPin()** (4 connections) — `backend/src/modules/shipping/address-resolve.service.ts`
- **readCoords()** (4 connections) — `backend/src/modules/shipping/address-resolve.service.ts`
- **connect-shipping-provider.dto.ts** (4 connections) — `backend/src/modules/shipping/dto/connect-shipping-provider.dto.ts`
- **resolve-address-from-names.dto.ts** (4 connections) — `backend/src/modules/shipping/dto/resolve-address-from-names.dto.ts`
- *... and 69 more nodes in this community*

## Relationships

- [class-validator](class-validator.md) (16 shared connections)
- [ShippingController](ShippingController.md) (15 shared connections)
- [shipping.service.ts](shipping.service.ts.md) (14 shared connections)
- [@nestjs/common](@nestjs-common.md) (13 shared connections)
- [@prisma/client](@prisma-client.md) (8 shared connections)
- [babel-express.adapter.ts](babel-express.adapter.ts.md) (7 shared connections)
- [shipping.module.ts](shipping.module.ts.md) (7 shared connections)
- [EncryptionService](EncryptionService.md) (6 shared connections)
- [client-oms-orders.service.ts](client-oms-orders.service.ts.md) (5 shared connections)
- [warehouse-tasks.controller.ts](warehouse-tasks.controller.ts.md) (5 shared connections)
- [geo-polygon.util.ts](geo-polygon.util.ts.md) (4 shared connections)
- [shipping-tracking.service.ts](shipping-tracking.service.ts.md) (4 shared connections)

## Source Files

- `backend/src/modules/client-portal/shipping/client-shipping.controller.ts`
- `backend/src/modules/shipping/address-resolve.service.ts`
- `backend/src/modules/shipping/address-resolve.service.unit.spec.ts`
- `backend/src/modules/shipping/dto/connect-shipping-provider.dto.ts`
- `backend/src/modules/shipping/dto/quote-shipping-rates.dto.ts`
- `backend/src/modules/shipping/dto/register-shipping-webhook.dto.ts`
- `backend/src/modules/shipping/dto/resolve-address-from-names.dto.ts`
- `backend/src/modules/shipping/dto/resolve-address-from-pin.dto.ts`
- `backend/src/modules/shipping/dto/upsert-shipping-origin-address.dto.ts`
- `backend/src/modules/shipping/location-match.ts`
- `backend/src/modules/shipping/location-match.unit.spec.ts`
- `backend/src/modules/shipping/providers/babel-express/babel-express.adapter.ts`
- `backend/src/modules/shipping/shipping.controller.ts`

## Audit Trail

- EXTRACTED: 237 (95%)
- INFERRED: 12 (5%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*