# shipping.module.ts

> 82 nodes · cohesion 0.06

## Key Concepts

- **shipping.module.ts** (68 connections) — `backend/src/modules/shipping/shipping.module.ts`
- **sena-express.adapter.ts** (39 connections) — `backend/src/modules/shipping/providers/sena-express/sena-express.adapter.ts`
- **shipping.constants.ts** (39 connections) — `backend/src/modules/shipping/shipping.constants.ts`
- **SenaExpressAdapter** (26 connections) — `backend/src/modules/shipping/providers/sena-express/sena-express.adapter.ts`
- **shipping-provider.registry.ts** (26 connections) — `backend/src/modules/shipping/shipping-provider.registry.ts`
- **shipping-webhook.controller.ts** (22 connections) — `backend/src/modules/shipping/shipping-webhook.controller.ts`
- **sena-express.mapper.ts** (20 connections) — `backend/src/modules/shipping/providers/sena-express/sena-express.mapper.ts`
- **carrier-native-tracking.unit.spec.ts** (19 connections) — `backend/src/modules/shipping/carrier-native-tracking.unit.spec.ts`
- **sena-express.webhook.util.ts** (18 connections) — `backend/src/modules/shipping/providers/sena-express/sena-express.webhook.util.ts`
- **mock-carrier.adapter.ts** (16 connections) — `backend/src/modules/shipping/providers/mock-carrier/mock-carrier.adapter.ts`
- **sena-express.types.ts** (15 connections) — `backend/src/modules/shipping/providers/sena-express/sena-express.types.ts`
- **SENA_EXPRESS_CODE** (14 connections) — `backend/src/modules/shipping/shipping.constants.ts`
- **ShippingCreateShipmentInput** (14 connections) — `backend/src/modules/shipping/shipping-provider.interface.ts`
- **MockCarrierAdapter** (13 connections) — `backend/src/modules/shipping/providers/mock-carrier/mock-carrier.adapter.ts`
- **sena-express.adapter.unit.spec.ts** (12 connections) — `backend/src/modules/shipping/providers/sena-express/sena-express.adapter.unit.spec.ts`
- **sena-express.http-client.ts** (11 connections) — `backend/src/modules/shipping/providers/sena-express/sena-express.http-client.ts`
- **sena-express.mapper.unit.spec.ts** (11 connections) — `backend/src/modules/shipping/providers/sena-express/sena-express.mapper.unit.spec.ts`
- **.createShipment()** (10 connections) — `backend/src/modules/shipping/providers/sena-express/sena-express.adapter.ts`
- **ShippingCreateShipmentResult** (10 connections) — `backend/src/modules/shipping/shipping-provider.interface.ts`
- **mock-carrier.unit.spec.ts** (9 connections) — `backend/src/modules/shipping/providers/mock-carrier/mock-carrier.unit.spec.ts`
- **SenaExpressHttpClient** (9 connections) — `backend/src/modules/shipping/providers/sena-express/sena-express.http-client.ts`
- **ShippingProviderCapabilities** (9 connections) — `backend/src/modules/shipping/shipping-provider.interface.ts`
- **sena-express.webhook.unit.spec.ts** (8 connections) — `backend/src/modules/shipping/providers/sena-express/sena-express.webhook.unit.spec.ts`
- **buildSenaNormalizedEvent()** (8 connections) — `backend/src/modules/shipping/providers/sena-express/sena-express.webhook.util.ts`
- **SenaShipment** (7 connections) — `backend/src/modules/shipping/providers/sena-express/sena-express.types.ts`
- *... and 57 more nodes in this community*

## Relationships

- [sila-sy.adapter.ts](sila-sy.adapter.ts.md) (44 shared connections)
- [shipping-tracking.service.ts](shipping-tracking.service.ts.md) (40 shared connections)
- [babel-express.adapter.ts](babel-express.adapter.ts.md) (33 shared connections)
- [shipping-preflight.ts](shipping-preflight.ts.md) (20 shared connections)
- [app.module.ts](app.module.ts.md) (19 shared connections)
- [sila-webhook.util.ts](sila-webhook.util.ts.md) (13 shared connections)
- [@nestjs/common](@nestjs-common.md) (11 shared connections)
- [EncryptionService](EncryptionService.md) (9 shared connections)
- [shipping.service.ts](shipping.service.ts.md) (7 shared connections)
- [shipping.controller.ts](shipping.controller.ts.md) (7 shared connections)
- [bulk-shipping.service.ts](bulk-shipping.service.ts.md) (7 shared connections)
- [ShippingProvider](ShippingProvider.md) (5 shared connections)

## Source Files

- `backend/src/modules/shipping/carrier-native-tracking.unit.spec.ts`
- `backend/src/modules/shipping/providers/mock-carrier/mock-carrier.adapter.ts`
- `backend/src/modules/shipping/providers/mock-carrier/mock-carrier.unit.spec.ts`
- `backend/src/modules/shipping/providers/sena-express/sena-express.adapter.ts`
- `backend/src/modules/shipping/providers/sena-express/sena-express.adapter.unit.spec.ts`
- `backend/src/modules/shipping/providers/sena-express/sena-express.constants.ts`
- `backend/src/modules/shipping/providers/sena-express/sena-express.http-client.ts`
- `backend/src/modules/shipping/providers/sena-express/sena-express.mapper.ts`
- `backend/src/modules/shipping/providers/sena-express/sena-express.mapper.unit.spec.ts`
- `backend/src/modules/shipping/providers/sena-express/sena-express.types.ts`
- `backend/src/modules/shipping/providers/sena-express/sena-express.webhook.unit.spec.ts`
- `backend/src/modules/shipping/providers/sena-express/sena-express.webhook.util.ts`
- `backend/src/modules/shipping/shipping-provider.interface.ts`
- `backend/src/modules/shipping/shipping-provider.registry.ts`
- `backend/src/modules/shipping/shipping-webhook.controller.ts`
- `backend/src/modules/shipping/shipping.constants.ts`
- `backend/src/modules/shipping/shipping.module.ts`

## Audit Trail

- EXTRACTED: 435 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*