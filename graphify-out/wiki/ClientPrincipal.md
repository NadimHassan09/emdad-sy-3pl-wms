# ClientPrincipal

> 224 nodes · cohesion 0.02

## Key Concepts

- **ClientPrincipal** (218 connections) — `backend/src/common/auth/client-principal.types.ts`
- **ClientUser** (96 connections) — `backend/src/modules/client-portal/auth/client-user.decorator.ts`
- **clientAuthPrincipal()** (59 connections) — `backend/src/common/auth/client-auth-principal.ts`
- **ClientOmsOrdersService** (34 connections) — `backend/src/modules/client-portal/oms/client-oms-orders.service.ts`
- **ClientOmsOrdersController** (24 connections) — `backend/src/modules/client-portal/oms/client-oms-orders.controller.ts`
- **ListClientOmsOrdersQueryDto** (19 connections) — `backend/src/modules/client-portal/oms/dto/list-client-oms-orders-query.dto.ts`
- **ClientOutboundOrdersService** (16 connections) — `backend/src/modules/client-portal/outbound/client-outbound-orders.service.ts`
- **ClientListOutboundQueryDto** (15 connections) — `backend/src/modules/client-portal/outbound/dto/client-list-outbound-query.dto.ts`
- **ClientCodReportQueryDto** (14 connections) — `backend/src/modules/client-portal/oms/dto/client-cod-report-query.dto.ts`
- **ClientOutboundOrdersController** (13 connections) — `backend/src/modules/client-portal/outbound/client-outbound-orders.controller.ts`
- **ClientProductsService** (13 connections) — `backend/src/modules/client-portal/products/client-products.service.ts`
- **ExternalOutboundService** (12 connections) — `backend/src/modules/client-portal/external-api/external-outbound.service.ts`
- **.findOne()** (12 connections) — `backend/src/modules/client-portal/oms/client-oms-orders.service.ts`
- **ExternalOutboundController** (11 connections) — `backend/src/modules/client-portal/external-api/external-outbound.controller.ts`
- **.exportOrders()** (11 connections) — `backend/src/modules/client-portal/outbound/client-outbound-orders.controller.ts`
- **ClientProductsController** (11 connections) — `backend/src/modules/client-portal/products/client-products.controller.ts`
- **.exportOrders()** (10 connections) — `backend/src/modules/client-portal/oms/client-oms-orders.controller.ts`
- **Get** (10 connections)
- **.listForExport()** (10 connections) — `backend/src/modules/client-portal/oms/client-oms-orders.service.ts`
- **.findOne()** (10 connections) — `backend/src/modules/client-portal/outbound/client-outbound-orders.service.ts`
- **.findById()** (10 connections) — `backend/src/modules/client-portal/products/client-products.service.ts`
- **ClientReturnsController** (10 connections) — `backend/src/modules/client-portal/returns/client-returns.controller.ts`
- **ClientReturnsService** (10 connections) — `backend/src/modules/client-portal/returns/client-returns.service.ts`
- **.exportCodReport()** (9 connections) — `backend/src/modules/client-portal/oms/client-oms-orders.controller.ts`
- **.codReport()** (9 connections) — `backend/src/modules/client-portal/oms/client-oms-orders.service.ts`
- *... and 199 more nodes in this community*

## Relationships

- [@nestjs/common](@nestjs-common.md) (110 shared connections)
- [client-oms-orders.service.ts](client-oms-orders.service.ts.md) (73 shared connections)
- [inbound-orders-csv.service.ts](inbound-orders-csv.service.ts.md) (39 shared connections)
- [api-credentials.service.ts](api-credentials.service.ts.md) (26 shared connections)
- [withTenantRls](withTenantRls.md) (25 shared connections)
- [ClientBillingService](ClientBillingService.md) (24 shared connections)
- [EmptyToUndefined](EmptyToUndefined.md) (22 shared connections)
- [oms-client-import.service.ts](oms-client-import.service.ts.md) (17 shared connections)
- [ClientInboundOrdersController](ClientInboundOrdersController.md) (11 shared connections)
- [MediaStorageService](MediaStorageService.md) (10 shared connections)
- [ClientNotificationsService](ClientNotificationsService.md) (10 shared connections)
- [ClientStockService](ClientStockService.md) (8 shared connections)

## Source Files

- `backend/src/common/auth/client-auth-principal.ts`
- `backend/src/common/auth/client-principal.types.ts`
- `backend/src/modules/billing/billing-access.service.ts`
- `backend/src/modules/client-portal/api-credentials/api-credentials.controller.ts`
- `backend/src/modules/client-portal/auth/client-user.decorator.ts`
- `backend/src/modules/client-portal/billing/client-billing.controller.ts`
- `backend/src/modules/client-portal/billing/client-billing.service.ts`
- `backend/src/modules/client-portal/dashboard/client-dashboard.controller.ts`
- `backend/src/modules/client-portal/external-api/external-inbound.controller.ts`
- `backend/src/modules/client-portal/external-api/external-inbound.service.ts`
- `backend/src/modules/client-portal/external-api/external-oms.controller.ts`
- `backend/src/modules/client-portal/external-api/external-oms.service.ts`
- `backend/src/modules/client-portal/external-api/external-outbound.controller.ts`
- `backend/src/modules/client-portal/external-api/external-outbound.service.ts`
- `backend/src/modules/client-portal/inbound/client-inbound-orders.controller.ts`
- `backend/src/modules/client-portal/inbound/client-inbound-orders.service.ts`
- `backend/src/modules/client-portal/notifications/client-notifications.controller.ts`
- `backend/src/modules/client-portal/oms-returns/client-oms-returns.controller.ts`
- `backend/src/modules/client-portal/oms-returns/client-oms-returns.service.ts`
- `backend/src/modules/client-portal/oms/client-oms-orders.controller.ts`

## Audit Trail

- EXTRACTED: 824 (86%)
- INFERRED: 129 (14%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*