# withTenantRls

> 173 nodes · cohesion 0.03

## Key Concepts

- **withTenantRls()** (113 connections) — `backend/src/common/prisma/tenant-rls.ts`
- **OmsOrdersService** (65 connections) — `backend/src/modules/oms/oms-orders.service.ts`
- **OutboundService** (63 connections) — `backend/src/modules/outbound/outbound.service.ts`
- **.create()** (39 connections) — `backend/src/modules/oms/oms-orders.service.ts`
- **serializeOmsOrder()** (35 connections) — `backend/src/modules/oms/oms-order.mapper.ts`
- **oms-order.mapper.ts** (33 connections) — `backend/src/modules/oms/oms-order.mapper.ts`
- **.create()** (32 connections) — `backend/src/modules/outbound/outbound.service.ts`
- **shipping-config.util.ts** (32 connections) — `backend/src/modules/shipping/shipping-config.util.ts`
- **ListOmsOrdersQueryDto** (28 connections) — `backend/src/modules/oms/dto/list-oms-orders-query.dto.ts`
- **.resolveOrder()** (26 connections) — `backend/src/modules/oms/oms-orders.service.ts`
- **.updatePlan()** (26 connections) — `backend/src/modules/outbound/outbound.service.ts`
- **.findById()** (25 connections) — `backend/src/modules/outbound/outbound.service.ts`
- **.resolveWriteCompanyId()** (24 connections) — `backend/src/common/company-access/company-access.service.ts`
- **.record()** (23 connections) — `backend/src/modules/oms/oms-order-events.service.ts`
- **outbound-bulk.service.ts** (23 connections) — `backend/src/modules/outbound/outbound-bulk.service.ts`
- **.saveShippingDetails()** (23 connections) — `backend/src/modules/outbound/outbound.service.ts`
- **.revertCancel()** (22 connections) — `backend/src/modules/oms/oms-orders.service.ts`
- **.update()** (22 connections) — `backend/src/modules/oms/oms-orders.service.ts`
- **.cancel()** (20 connections) — `backend/src/modules/oms/oms-orders.service.ts`
- **.completeShippingDetailsAdmin()** (20 connections) — `backend/src/modules/outbound/outbound.service.ts`
- **.emitOutboundOrderUpdated()** (20 connections) — `backend/src/modules/realtime/realtime.service.ts`
- **OmsBulkService** (18 connections) — `backend/src/modules/oms/oms-bulk.service.ts`
- **.selectShippingMethodAdmin()** (18 connections) — `backend/src/modules/outbound/outbound.service.ts`
- **.emitOms()** (17 connections) — `backend/src/modules/oms/oms-orders.service.ts`
- **adminOutboundListItem()** (17 connections) — `backend/src/modules/realtime/realtime-client.payload.ts`
- *... and 148 more nodes in this community*

## Relationships

- [outbound.service.ts](outbound.service.ts.md) (100 shared connections)
- [AuthPrincipal](AuthPrincipal.md) (89 shared connections)
- [.fromPrincipal](fromPrincipal.md) (63 shared connections)
- [@prisma/client](@prisma-client.md) (41 shared connections)
- [CurrentUser](CurrentUser.md) (40 shared connections)
- [task-inventory-effects.service.ts](task-inventory-effects.service.ts.md) (32 shared connections)
- [shipping.service.ts](shipping.service.ts.md) (28 shared connections)
- [shipping-tracking.service.ts](shipping-tracking.service.ts.md) (26 shared connections)
- [ClientPrincipal](ClientPrincipal.md) (25 shared connections)
- [oms-client-import.service.ts](oms-client-import.service.ts.md) (25 shared connections)
- [.validateResourceOwnership](validateResourceOwnership.md) (15 shared connections)
- [client-oms-orders.service.ts](client-oms-orders.service.ts.md) (15 shared connections)

## Source Files

- `backend/scripts/verify-inbound-traceability-staging.ts`
- `backend/src/common/company-access/company-access.service.ts`
- `backend/src/common/prisma/tenant-rls.ts`
- `backend/src/common/utils/async-pool.ts`
- `backend/src/common/utils/async-pool.unit.spec.ts`
- `backend/src/common/utils/order-planning-date.ts`
- `backend/src/modules/billing/billing-access.service.ts`
- `backend/src/modules/client-portal/oms/client-oms-orders.service.ts`
- `backend/src/modules/client-portal/order-import/outbound-client-import.service.ts`
- `backend/src/modules/client-portal/outbound/client-outbound-orders.service.ts`
- `backend/src/modules/inbound/inbound.service.ts`
- `backend/src/modules/oms/dto/list-oms-orders-query.dto.ts`
- `backend/src/modules/oms/dto/oms-order.dto.ts`
- `backend/src/modules/oms/inbound-traceability.service.ts`
- `backend/src/modules/oms/oms-bulk.service.ts`
- `backend/src/modules/oms/oms-cancel-revert.ts`
- `backend/src/modules/oms/oms-delivery-resolution.ts`
- `backend/src/modules/oms/oms-order-events.service.ts`
- `backend/src/modules/oms/oms-order-transitions.ts`
- `backend/src/modules/oms/oms-order.mapper.ts`

## Audit Trail

- EXTRACTED: 905 (77%)
- INFERRED: 271 (23%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*