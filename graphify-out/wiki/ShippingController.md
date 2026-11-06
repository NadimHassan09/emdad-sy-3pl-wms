# ShippingController

> 61 nodes · cohesion 0.07

## Key Concepts

- **ShippingController** (37 connections) — `backend/src/modules/shipping/shipping.controller.ts`
- **Post** (16 connections)
- **.decrypt()** (15 connections) — `backend/src/common/crypto/encryption.service.ts`
- **BabelGeoSyncService** (13 connections) — `backend/src/modules/shipping/providers/babel-express/babel-geo-sync.service.ts`
- **Param** (13 connections)
- **Body** (12 connections)
- **Get** (12 connections)
- **.connect()** (8 connections) — `backend/src/modules/shipping/shipping.controller.ts`
- **.registerWebhook()** (8 connections) — `backend/src/modules/shipping/shipping.controller.ts`
- **BulkShippingConfirmDto** (7 connections) — `backend/src/modules/shipping/dto/bulk-shipping.dto.ts`
- **BulkShippingConfirmItemDto** (7 connections) — `backend/src/modules/shipping/dto/bulk-shipping.dto.ts`
- **.confirm()** (7 connections) — `backend/src/modules/shipping/shipping.controller.ts`
- **.saveOriginAddress()** (7 connections) — `backend/src/modules/shipping/shipping.controller.ts`
- **BulkShippingPreviewDto** (6 connections) — `backend/src/modules/shipping/dto/bulk-shipping.dto.ts`
- **.preview()** (5 connections) — `backend/src/modules/shipping/shipping.controller.ts`
- **.quoteRates()** (5 connections) — `backend/src/modules/shipping/shipping.controller.ts`
- **.resolveAddressFromNames()** (5 connections) — `backend/src/modules/shipping/shipping.controller.ts`
- **.resolveAddressFromPin()** (5 connections) — `backend/src/modules/shipping/shipping.controller.ts`
- **.resolveNeighbourhood()** (5 connections) — `backend/src/modules/shipping/shipping.controller.ts`
- **.retry()** (5 connections) — `backend/src/modules/shipping/shipping.controller.ts`
- **.retryItem()** (5 connections) — `backend/src/modules/shipping/shipping.controller.ts`
- **.testFxSource()** (5 connections) — `backend/src/modules/shipping/shipping.controller.ts`
- **.babelAreas()** (4 connections) — `backend/src/modules/shipping/shipping.controller.ts`
- **.babelNeighbourhoods()** (4 connections) — `backend/src/modules/shipping/shipping.controller.ts`
- **.carrierCosts()** (4 connections) — `backend/src/modules/shipping/shipping.controller.ts`
- *... and 36 more nodes in this community*

## Relationships

- [shipping.service.ts](shipping.service.ts.md) (22 shared connections)
- [shipping.controller.ts](shipping.controller.ts.md) (15 shared connections)
- [shipping-tracking.service.ts](shipping-tracking.service.ts.md) (5 shared connections)
- [shipping-fx.service.ts](shipping-fx.service.ts.md) (5 shared connections)
- [EncryptionService](EncryptionService.md) (4 shared connections)
- [CurrentUser](CurrentUser.md) (4 shared connections)
- [AuthPrincipal](AuthPrincipal.md) (4 shared connections)
- [class-validator](class-validator.md) (3 shared connections)
- [shipping.module.ts](shipping.module.ts.md) (2 shared connections)
- [babel-express.adapter.ts](babel-express.adapter.ts.md) (2 shared connections)
- [sila-sy.adapter.ts](sila-sy.adapter.ts.md) (1 shared connections)
- [bulk-shipping.service.ts](bulk-shipping.service.ts.md) (1 shared connections)

## Source Files

- `backend/src/common/crypto/encryption.service.ts`
- `backend/src/modules/shipping/dto/bulk-shipping.dto.ts`
- `backend/src/modules/shipping/providers/babel-express/babel-geo-sync.service.ts`
- `backend/src/modules/shipping/shipping.controller.ts`
- `backend/src/modules/shipping/shipping.service.ts`

## Audit Trail

- EXTRACTED: 148 (78%)
- INFERRED: 42 (22%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*