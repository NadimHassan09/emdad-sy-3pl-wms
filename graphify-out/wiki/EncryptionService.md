# EncryptionService

> 35 nodes · cohesion 0.09

## Key Concepts

- **EncryptionService** (20 connections) — `backend/src/common/crypto/encryption.service.ts`
- **ShippingProviderRegistry** (20 connections) — `backend/src/modules/shipping/shipping-provider.registry.ts`
- **ShippingAutoReturnService** (17 connections) — `backend/src/modules/shipping/shipping-auto-return.service.ts`
- **.emitOmsOrderEvent()** (14 connections) — `backend/src/modules/realtime/realtime.service.ts`
- **.constructor()** (12 connections) — `backend/src/modules/shipping/shipping.controller.ts`
- **babel-address.adapter.ts** (10 connections) — `backend/src/modules/shipping/providers/babel-express/babel-address.adapter.ts`
- **BabelAddressAdapter** (10 connections) — `backend/src/modules/shipping/providers/babel-express/babel-address.adapter.ts`
- **.emitOmsReturnEvent()** (9 connections) — `backend/src/modules/realtime/realtime.service.ts`
- **.confirmWarehouseReturnReceipt()** (9 connections) — `backend/src/modules/shipping/shipping-auto-return.service.ts`
- **.processCarrierReturnEvent()** (9 connections) — `backend/src/modules/shipping/shipping-auto-return.service.ts`
- **.constructor()** (9 connections) — `backend/src/modules/shipping/shipping.service.ts`
- **.resolveNeighbourhoodId()** (7 connections) — `backend/src/modules/shipping/providers/babel-express/babel-address.adapter.ts`
- **.cancelUnconfirmedDraftReturns()** (7 connections) — `backend/src/modules/shipping/shipping-auto-return.service.ts`
- **.constructor()** (6 connections) — `backend/src/modules/shipping/shipping-tracking.service.ts`
- **.handleCarrierDeliveredEvent()** (5 connections) — `backend/src/modules/shipping/shipping-auto-return.service.ts`
- **.constructor()** (5 connections) — `backend/src/modules/shipping/shipping-provider.registry.ts`
- **.confirmWarehouseReturnReceiptForOrder()** (4 connections) — `backend/src/modules/shipping/shipping-auto-return.service.ts`
- **.encrypt()** (3 connections) — `backend/src/common/crypto/encryption.service.ts`
- **.resolveKey()** (3 connections) — `backend/src/common/crypto/encryption.service.ts`
- **lookupBabelNeighbourhoodIdFromIndex()** (3 connections) — `backend/src/modules/shipping/providers/babel-express/babel-address.adapter.ts`
- **babel-address.adapter.unit.spec.ts** (3 connections) — `backend/src/modules/shipping/providers/babel-express/babel-address.adapter.unit.spec.ts`
- **.promoteOrderToReturnPendingReceipt()** (3 connections) — `backend/src/modules/shipping/shipping-auto-return.service.ts`
- **backend_src_data_syria_locations_babel_address_index** (2 connections)
- **.constructor()** (2 connections) — `backend/src/modules/shipping/providers/babel-express/babel-address.adapter.ts`
- **.isBabelCovered()** (2 connections) — `backend/src/modules/shipping/providers/babel-express/babel-address.adapter.ts`
- *... and 10 more nodes in this community*

## Relationships

- [shipping.service.ts](shipping.service.ts.md) (14 shared connections)
- [shipping-tracking.service.ts](shipping-tracking.service.ts.md) (13 shared connections)
- [RealtimeService](RealtimeService.md) (11 shared connections)
- [shipping.module.ts](shipping.module.ts.md) (9 shared connections)
- [withTenantRls](withTenantRls.md) (8 shared connections)
- [@prisma/client](@prisma-client.md) (8 shared connections)
- [shipping.controller.ts](shipping.controller.ts.md) (6 shared connections)
- [babel-express.adapter.ts](babel-express.adapter.ts.md) (5 shared connections)
- [ShippingController](ShippingController.md) (4 shared connections)
- [task-inventory-effects.service.ts](task-inventory-effects.service.ts.md) (4 shared connections)
- [CodRecordsService](CodRecordsService.md) (4 shared connections)
- [.validateResourceOwnership](validateResourceOwnership.md) (3 shared connections)

## Source Files

- `backend/src/common/crypto/encryption.service.ts`
- `backend/src/modules/realtime/realtime.service.ts`
- `backend/src/modules/shipping/providers/babel-express/babel-address.adapter.ts`
- `backend/src/modules/shipping/providers/babel-express/babel-address.adapter.unit.spec.ts`
- `backend/src/modules/shipping/shipping-auto-return.service.ts`
- `backend/src/modules/shipping/shipping-provider.registry.ts`
- `backend/src/modules/shipping/shipping-tracking.service.ts`
- `backend/src/modules/shipping/shipping.controller.ts`
- `backend/src/modules/shipping/shipping.service.ts`

## Audit Trail

- EXTRACTED: 121 (78%)
- INFERRED: 35 (22%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*