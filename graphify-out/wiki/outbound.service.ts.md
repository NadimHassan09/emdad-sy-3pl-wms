# outbound.service.ts

> 155 nodes · cohesion 0.03

## Key Concepts

- **outbound.service.ts** (144 connections) — `backend/src/modules/outbound/outbound.service.ts`
- **oms-orders.service.ts** (126 connections) — `backend/src/modules/oms/oms-orders.service.ts`
- **InvalidStateException** (92 connections) — `backend/src/common/errors/domain-exceptions.ts`
- **inbound.service.ts** (90 connections) — `backend/src/modules/inbound/inbound.service.ts`
- **domain-exceptions.ts** (43 connections) — `backend/src/common/errors/domain-exceptions.ts`
- **oms-cancel-revert.ts** (29 connections) — `backend/src/modules/oms/oms-cancel-revert.ts`
- **oms-outbound-sync.service.ts** (25 connections) — `backend/src/modules/oms/oms-outbound-sync.service.ts`
- **.quickDirectedOutbound()** (24 connections) — `backend/src/modules/outbound/outbound.service.ts`
- **.receiveLine()** (23 connections) — `backend/src/modules/inbound/inbound.service.ts`
- **billing-access.service.ts** (20 connections) — `backend/src/modules/billing/billing-access.service.ts`
- **assertProductOrderableForOrders()** (17 connections) — `backend/src/common/utils/assert-product-orderable.ts`
- **oms-order-transitions.ts** (17 connections) — `backend/src/modules/oms/oms-order-transitions.ts`
- **DomainException** (16 connections) — `backend/src/common/errors/domain-exceptions.ts`
- **outbound-admin-stages.ts** (15 connections) — `backend/src/modules/outbound/outbound-admin-stages.ts`
- **outbound-confirm-lock.util.ts** (14 connections) — `backend/src/modules/outbound/outbound-confirm-lock.util.ts`
- **inbound-admin-stages.ts** (11 connections) — `backend/src/modules/inbound/inbound-admin-stages.ts`
- **assertOutboundAdminStageAction()** (11 connections) — `backend/src/modules/outbound/outbound-admin-stages.ts`
- **.gateConfirmTransaction()** (11 connections) — `backend/src/modules/outbound/outbound.service.ts`
- **all-exceptions.filter.ts** (10 connections) — `backend/src/common/filters/all-exceptions.filter.ts`
- **warehouse-order-scope.ts** (10 connections) — `backend/src/common/utils/warehouse-order-scope.ts`
- **isOutboundConfirmable()** (10 connections) — `backend/src/modules/outbound/outbound-confirm-lock.util.ts`
- **taskOnlyFlows()** (10 connections) — `backend/src/modules/warehouse-workflow/feature-flags.ts`
- **setTenantRlsContext()** (9 connections) — `backend/src/common/prisma/tenant-rls.ts`
- **oms-cancel-revert.unit.spec.ts** (9 connections) — `backend/src/modules/oms/oms-cancel-revert.unit.spec.ts`
- **oms-return-admin-stages.ts** (9 connections) — `backend/src/modules/oms-returns/oms-return-admin-stages.ts`
- *... and 130 more nodes in this community*

## Relationships

- [withTenantRls](withTenantRls.md) (100 shared connections)
- [@prisma/client](@prisma-client.md) (96 shared connections)
- [.fromPrincipal](fromPrincipal.md) (68 shared connections)
- [task-inventory-effects.service.ts](task-inventory-effects.service.ts.md) (53 shared connections)
- [@nestjs/common](@nestjs-common.md) (23 shared connections)
- [warehouse-tasks.service.ts](warehouse-tasks.service.ts.md) (19 shared connections)
- [returns.service.ts](returns.service.ts.md) (16 shared connections)
- [.validateResourceOwnership](validateResourceOwnership.md) (14 shared connections)
- [cycle-count.service.ts](cycle-count.service.ts.md) (12 shared connections)
- [CycleCountService](CycleCountService.md) (11 shared connections)
- [RealtimeService](RealtimeService.md) (11 shared connections)
- [AuthPrincipal](AuthPrincipal.md) (9 shared connections)

## Source Files

- `backend/src/common/constants/storage-location-types.ts`
- `backend/src/common/errors/billing-exceptions.ts`
- `backend/src/common/errors/domain-exceptions.ts`
- `backend/src/common/filters/all-exceptions.filter.ts`
- `backend/src/common/prisma/tenant-rls.ts`
- `backend/src/common/utils/assert-product-orderable.ts`
- `backend/src/common/utils/warehouse-order-scope.ts`
- `backend/src/modules/billing/billing-access.service.ts`
- `backend/src/modules/cycle-count/cycle-count-variance.service.ts`
- `backend/src/modules/inbound/inbound-admin-stages.ts`
- `backend/src/modules/inbound/inbound-admin-stages.unit.spec.ts`
- `backend/src/modules/inbound/inbound.service.ts`
- `backend/src/modules/oms-returns/oms-return-admin-stages.ts`
- `backend/src/modules/oms-returns/oms-return-admin-stages.unit.spec.ts`
- `backend/src/modules/oms/oms-cancel-revert.ts`
- `backend/src/modules/oms/oms-cancel-revert.unit.spec.ts`
- `backend/src/modules/oms/oms-order-delete.policy.ts`
- `backend/src/modules/oms/oms-order-delete.policy.unit.spec.ts`
- `backend/src/modules/oms/oms-order-transitions.ts`
- `backend/src/modules/oms/oms-order-transitions.unit.spec.ts`

## Audit Trail

- EXTRACTED: 862 (98%)
- INFERRED: 21 (2%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*