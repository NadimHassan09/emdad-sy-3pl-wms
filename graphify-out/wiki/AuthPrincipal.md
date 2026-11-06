# AuthPrincipal

> 106 nodes · cohesion 0.05

## Key Concepts

- **AuthPrincipal** (955 connections) — `backend/src/common/auth/current-user.types.ts`
- **OutboundController** (34 connections) — `backend/src/modules/outbound/outbound.controller.ts`
- **Post** (22 connections)
- **OutboundBulkService** (18 connections) — `backend/src/modules/outbound/outbound-bulk.service.ts`
- **Body** (15 connections)
- **Param** (14 connections)
- **BulkOutboundIdsDto** (11 connections) — `backend/src/modules/outbound/dto/bulk-outbound.dto.ts`
- **.exportOrdersPost()** (11 connections) — `backend/src/modules/outbound/outbound.controller.ts`
- **Throttle** (11 connections)
- **.list()** (11 connections) — `backend/src/modules/outbound/outbound.service.ts`
- **.processBulk()** (10 connections) — `backend/src/modules/outbound/outbound-bulk.service.ts`
- **.exportOrders()** (10 connections) — `backend/src/modules/outbound/outbound.controller.ts`
- **.importOrders()** (9 connections) — `backend/src/modules/outbound/outbound.controller.ts`
- **WorkflowWorkersController** (9 connections) — `backend/src/modules/warehouse-workflow/workflow-workers.controller.ts`
- **BulkProcessOutboundDto** (8 connections) — `backend/src/modules/outbound/dto/bulk-outbound.dto.ts`
- **BulkShippingDetailsDto** (8 connections) — `backend/src/modules/outbound/dto/bulk-outbound.dto.ts`
- **.bulkCompleteDispatch()** (8 connections) — `backend/src/modules/outbound/outbound.controller.ts`
- **.bulkCompletePacking()** (8 connections) — `backend/src/modules/outbound/outbound.controller.ts`
- **.bulkCompletePicking()** (8 connections) — `backend/src/modules/outbound/outbound.controller.ts`
- **.bulkCompleteShippingDetails()** (8 connections) — `backend/src/modules/outbound/outbound.controller.ts`
- **.bulkProcess()** (8 connections) — `backend/src/modules/outbound/outbound.controller.ts`
- **.bulkShippingDetails()** (8 connections) — `backend/src/modules/outbound/outbound.controller.ts`
- **.bulkShippingDetailsPreview()** (8 connections) — `backend/src/modules/outbound/outbound.controller.ts`
- **.confirm()** (8 connections) — `backend/src/modules/outbound/outbound.controller.ts`
- **.saveShippingDetails()** (8 connections) — `backend/src/modules/outbound/outbound.controller.ts`
- *... and 81 more nodes in this community*

## Relationships

- [CurrentUser](CurrentUser.md) (102 shared connections)
- [withTenantRls](withTenantRls.md) (89 shared connections)
- [@prisma/client](@prisma-client.md) (72 shared connections)
- [RunReportQueryDto](RunReportQueryDto.md) (53 shared connections)
- [BillingController](BillingController.md) (52 shared connections)
- [.validateResourceOwnership](validateResourceOwnership.md) (47 shared connections)
- [WarehouseTasksService](WarehouseTasksService.md) (46 shared connections)
- [CycleCountService](CycleCountService.md) (40 shared connections)
- [.fromPrincipal](fromPrincipal.md) (39 shared connections)
- [@nestjs/common](@nestjs-common.md) (33 shared connections)
- [.assertCompanyAccess](assertCompanyAccess.md) (29 shared connections)
- [warehouse-tasks.service.ts](warehouse-tasks.service.ts.md) (22 shared connections)

## Source Files

- `backend/src/common/auth/current-user.types.ts`
- `backend/src/common/company-access/company-access.service.ts`
- `backend/src/modules/notifications/notifications.controller.ts`
- `backend/src/modules/notifications/notifications.service.ts`
- `backend/src/modules/outbound/dto/bulk-outbound.dto.ts`
- `backend/src/modules/outbound/outbound-bulk.service.ts`
- `backend/src/modules/outbound/outbound-orders-csv.service.ts`
- `backend/src/modules/outbound/outbound.controller.ts`
- `backend/src/modules/outbound/outbound.service.ts`
- `backend/src/modules/warehouse-workflow/analytics-overview.controller.ts`
- `backend/src/modules/warehouse-workflow/workflow-workers.controller.ts`
- `backend/src/modules/warehouse-workflow/workflow-workers.service.ts`

## Audit Trail

- EXTRACTED: 1236 (96%)
- INFERRED: 57 (4%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*