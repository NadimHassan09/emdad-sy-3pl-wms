# client-oms-orders.service.ts

> 89 nodes · cohesion 0.04

## Key Concepts

- **client-oms-orders.service.ts** (43 connections) — `backend/src/modules/client-portal/oms/client-oms-orders.service.ts`
- **external-oms.service.ts** (38 connections) — `backend/src/modules/client-portal/external-api/external-oms.service.ts`
- **external-inbound.service.ts** (24 connections) — `backend/src/modules/client-portal/external-api/external-inbound.service.ts`
- **external-outbound.service.ts** (24 connections) — `backend/src/modules/client-portal/external-api/external-outbound.service.ts`
- **.create()** (18 connections) — `backend/src/modules/client-portal/external-api/external-oms.service.ts`
- **shipping-geo.service.ts** (18 connections) — `backend/src/modules/shipping/shipping-geo.service.ts`
- **ShippingGeoService** (18 connections) — `backend/src/modules/shipping/shipping-geo.service.ts`
- **public-order.serialize.ts** (17 connections) — `backend/src/modules/client-portal/external-api/public-order.serialize.ts`
- **ExternalOmsService** (14 connections) — `backend/src/modules/client-portal/external-api/external-oms.service.ts`
- **external-api-payload.util.ts** (13 connections) — `backend/src/modules/client-portal/external-api/external-api-payload.util.ts`
- **.create()** (13 connections) — `backend/src/modules/client-portal/external-api/external-inbound.service.ts`
- **.create()** (13 connections) — `backend/src/modules/client-portal/external-api/external-outbound.service.ts`
- **oms-delivery-resolution.ts** (13 connections) — `backend/src/modules/oms/oms-delivery-resolution.ts`
- **ExternalInboundService** (12 connections) — `backend/src/modules/client-portal/external-api/external-inbound.service.ts`
- **ExternalInboundController** (11 connections) — `backend/src/modules/client-portal/external-api/external-inbound.controller.ts`
- **ExternalOmsController** (11 connections) — `backend/src/modules/client-portal/external-api/external-oms.controller.ts`
- **external-oms.service.unit.spec.ts** (11 connections) — `backend/src/modules/client-portal/external-api/external-oms.service.unit.spec.ts`
- **publicOmsOrder()** (11 connections) — `backend/src/modules/client-portal/external-api/public-order.serialize.ts`
- **publicOutboundOrder()** (10 connections) — `backend/src/modules/client-portal/external-api/public-order.serialize.ts`
- **external-api/syria-address.ts** (10 connections) — `backend/src/modules/client-portal/external-api/syria-address.ts`
- **.findOne()** (10 connections) — `backend/src/modules/client-portal/inbound/client-inbound-orders.service.ts`
- **ClientOmsStatusSummaryQueryDto** (10 connections) — `backend/src/modules/client-portal/oms/dto/client-oms-status-summary-query.dto.ts`
- **throwApiValidation()** (9 connections) — `backend/src/modules/client-portal/external-api/api-validation.ts`
- **publicInboundOrder()** (9 connections) — `backend/src/modules/client-portal/external-api/public-order.serialize.ts`
- **.findOneByLookup()** (8 connections) — `backend/src/modules/client-portal/external-api/external-inbound.service.ts`
- *... and 64 more nodes in this community*

## Relationships

- [ClientPrincipal](ClientPrincipal.md) (73 shared connections)
- [@nestjs/common](@nestjs-common.md) (36 shared connections)
- [oms-client-import.service.ts](oms-client-import.service.ts.md) (26 shared connections)
- [withTenantRls](withTenantRls.md) (15 shared connections)
- [@prisma/client](@prisma-client.md) (12 shared connections)
- [geo-polygon.util.ts](geo-polygon.util.ts.md) (12 shared connections)
- [EmptyToUndefined](EmptyToUndefined.md) (10 shared connections)
- [CreateOmsOrderDto](CreateOmsOrderDto.md) (10 shared connections)
- [inbound-orders-csv.service.ts](inbound-orders-csv.service.ts.md) (7 shared connections)
- [shipping.controller.ts](shipping.controller.ts.md) (5 shared connections)
- [outbound.service.ts](outbound.service.ts.md) (4 shared connections)
- [ExternalCreateInboundOrderDto](ExternalCreateInboundOrderDto.md) (3 shared connections)

## Source Files

- `backend/src/modules/client-portal/external-api/api-validation.ts`
- `backend/src/modules/client-portal/external-api/external-api-payload.util.ts`
- `backend/src/modules/client-portal/external-api/external-inbound.controller.ts`
- `backend/src/modules/client-portal/external-api/external-inbound.service.ts`
- `backend/src/modules/client-portal/external-api/external-oms.controller.ts`
- `backend/src/modules/client-portal/external-api/external-oms.service.ts`
- `backend/src/modules/client-portal/external-api/external-oms.service.unit.spec.ts`
- `backend/src/modules/client-portal/external-api/external-outbound.service.ts`
- `backend/src/modules/client-portal/external-api/public-order.serialize.ts`
- `backend/src/modules/client-portal/external-api/public-order.serialize.unit.spec.ts`
- `backend/src/modules/client-portal/external-api/syria-address.ts`
- `backend/src/modules/client-portal/external-api/syria-address.unit.spec.ts`
- `backend/src/modules/client-portal/inbound/client-inbound-orders.service.ts`
- `backend/src/modules/client-portal/oms/client-oms-orders.service.ts`
- `backend/src/modules/client-portal/oms/dto/client-oms-status-summary-query.dto.ts`
- `backend/src/modules/client-portal/oms/portal-cod-status.util.ts`
- `backend/src/modules/client-portal/oms/portal-cod-status.util.unit.spec.ts`
- `backend/src/modules/client-portal/order-import/oms-client-import.service.ts`
- `backend/src/modules/oms/oms-delivery-resolution.ts`
- `backend/src/modules/shipping/geo-polygon.util.ts`

## Audit Trail

- EXTRACTED: 376 (93%)
- INFERRED: 28 (7%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*