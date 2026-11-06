# shipping-tracking.service.ts

> 114 nodes · cohesion 0.04

## Key Concepts

- **shipping-tracking.service.ts** (75 connections) — `backend/src/modules/shipping/shipping-tracking.service.ts`
- **ShippingTrackingService** (43 connections) — `backend/src/modules/shipping/shipping-tracking.service.ts`
- **shipping-provider.interface.ts** (38 connections) — `backend/src/modules/shipping/shipping-provider.interface.ts`
- **shipping-lifecycle.util.ts** (34 connections) — `backend/src/modules/shipping/shipping-lifecycle.util.ts`
- **shipping-carrier-resolver.ts** (26 connections) — `backend/src/modules/shipping/shipping-carrier-resolver.ts`
- **NormalizedTrackingEvent** (24 connections) — `backend/src/modules/shipping/shipping-provider.interface.ts`
- **.processTrackingEvent()** (21 connections) — `backend/src/modules/shipping/shipping-tracking.service.ts`
- **resolveShippingCarrierName()** (20 connections) — `backend/src/modules/shipping/shipping-carrier-resolver.ts`
- **shipping-lifecycle.util.unit.spec.ts** (17 connections) — `backend/src/modules/shipping/shipping-lifecycle.util.unit.spec.ts`
- **sila-event-sync.service.ts** (17 connections) — `backend/src/modules/shipping/sila-event-sync.service.ts`
- **shipping-lookup.util.ts** (14 connections) — `backend/src/modules/shipping/shipping-lookup.util.ts`
- **encryption.service.ts** (12 connections) — `backend/src/common/crypto/encryption.service.ts`
- **mergeShipmentRawMeta()** (12 connections) — `backend/src/modules/shipping/providers/sila-sy/sila-meta.util.ts`
- **ShipmentTrackingResult** (12 connections) — `backend/src/modules/shipping/shipping-provider.interface.ts`
- **shipping-sync.scheduler.ts** (12 connections) — `backend/src/modules/shipping/shipping-sync.scheduler.ts`
- **.cancelCarrierShipmentForOrder()** (12 connections) — `backend/src/modules/shipping/shipping-tracking.service.ts`
- **sila-meta.util.ts** (11 connections) — `backend/src/modules/shipping/providers/sila-sy/sila-meta.util.ts`
- **.persistConfirmedSilaCourier()** (11 connections) — `backend/src/modules/shipping/shipping-tracking.service.ts`
- **oms-waybill.service.unit.spec.ts** (9 connections) — `backend/src/modules/oms/oms-waybill.service.unit.spec.ts`
- **babel-cancellation.reconciliation.unit.spec.ts** (9 connections) — `backend/src/modules/shipping/babel-cancellation.reconciliation.unit.spec.ts`
- **normalizeCourierDisplayName()** (9 connections) — `backend/src/modules/shipping/shipping-carrier-resolver.ts`
- **ShippingCancelResult** (9 connections) — `backend/src/modules/shipping/shipping-provider.interface.ts`
- **NormalizedTrackingStatus** (8 connections) — `backend/src/modules/shipping/shipping-provider.interface.ts`
- **.finalizeTrackingHistoryIdentity()** (8 connections) — `backend/src/modules/shipping/shipping-tracking.service.ts`
- **.getShipmentTrackingHistory()** (8 connections) — `backend/src/modules/shipping/shipping-tracking.service.ts`
- *... and 89 more nodes in this community*

## Relationships

- [shipping.module.ts](shipping.module.ts.md) (40 shared connections)
- [sila-sy.adapter.ts](sila-sy.adapter.ts.md) (27 shared connections)
- [withTenantRls](withTenantRls.md) (26 shared connections)
- [shipping.service.ts](shipping.service.ts.md) (24 shared connections)
- [@prisma/client](@prisma-client.md) (22 shared connections)
- [oms-waybill.service.ts](oms-waybill.service.ts.md) (20 shared connections)
- [babel-express.adapter.ts](babel-express.adapter.ts.md) (19 shared connections)
- [EncryptionService](EncryptionService.md) (13 shared connections)
- [shipping-preflight.ts](shipping-preflight.ts.md) (10 shared connections)
- [outbound.service.ts](outbound.service.ts.md) (7 shared connections)
- [@nestjs/common](@nestjs-common.md) (6 shared connections)
- [OmsShippingScanService](OmsShippingScanService.md) (5 shared connections)

## Source Files

- `backend/src/common/crypto/encryption.service.ts`
- `backend/src/modules/oms/oms-orders.service.ts`
- `backend/src/modules/oms/oms-waybill.service.unit.spec.ts`
- `backend/src/modules/shipping/babel-cancellation.reconciliation.unit.spec.ts`
- `backend/src/modules/shipping/carrier-status-matrix.unit.spec.ts`
- `backend/src/modules/shipping/pre-dispatch-cancel-flow.unit.spec.ts`
- `backend/src/modules/shipping/providers/babel-express/babel-express.adapter.ts`
- `backend/src/modules/shipping/providers/sila-sy/sila-identifiers.ts`
- `backend/src/modules/shipping/providers/sila-sy/sila-meta.util.ts`
- `backend/src/modules/shipping/providers/sila-sy/sila-meta.util.unit.spec.ts`
- `backend/src/modules/shipping/shipping-carrier-resolver.ts`
- `backend/src/modules/shipping/shipping-carrier-resolver.unit.spec.ts`
- `backend/src/modules/shipping/shipping-lifecycle.util.ts`
- `backend/src/modules/shipping/shipping-lifecycle.util.unit.spec.ts`
- `backend/src/modules/shipping/shipping-lookup.util.ts`
- `backend/src/modules/shipping/shipping-lookup.util.unit.spec.ts`
- `backend/src/modules/shipping/shipping-provider.interface.ts`
- `backend/src/modules/shipping/shipping-sync.scheduler.ts`
- `backend/src/modules/shipping/shipping-tracking.service.ts`
- `backend/src/modules/shipping/shipping-tracking.service.unit.spec.ts`

## Audit Trail

- EXTRACTED: 499 (95%)
- INFERRED: 27 (5%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*