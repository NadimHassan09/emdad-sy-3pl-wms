# inbound-orders-csv.service.ts

> 131 nodes · cohesion 0.03

## Key Concepts

- **inbound-orders-csv.service.ts** (47 connections) — `backend/src/modules/inbound/inbound-orders-csv.service.ts`
- **client-oms-export.service.ts** (24 connections) — `backend/src/modules/client-portal/order-export/client-oms-export.service.ts`
- **client-inbound-export.service.ts** (23 connections) — `backend/src/modules/client-portal/order-export/client-inbound-export.service.ts`
- **client-outbound-export.service.ts** (23 connections) — `backend/src/modules/client-portal/order-export/client-outbound-export.service.ts`
- **buildExcelBuffer()** (21 connections) — `backend/src/common/utils/excel-export.util.ts`
- **exportProductNames()** (19 connections) — `backend/src/modules/oms/order-export-product-cells.ts`
- **exportProductWeights()** (19 connections) — `backend/src/modules/oms/order-export-product-cells.ts`
- **ClientInboundOrdersService** (16 connections) — `backend/src/modules/client-portal/inbound/client-inbound-orders.service.ts`
- **ClientOmsOrdersExportDto** (16 connections) — `backend/src/modules/client-portal/oms/dto/bulk-confirm-client-oms-orders.dto.ts`
- **excel-export.util.ts** (15 connections) — `backend/src/common/utils/excel-export.util.ts`
- **ClientInboundOrdersExportDto** (15 connections) — `backend/src/modules/client-portal/inbound/dto/client-inbound-export.dto.ts`
- **ClientOutboundOrdersExportDto** (15 connections) — `backend/src/modules/client-portal/outbound/dto/client-outbound-export.dto.ts`
- **InboundOrdersCsvService** (15 connections) — `backend/src/modules/inbound/inbound-orders-csv.service.ts`
- **order-export-product-cells.ts** (15 connections) — `backend/src/modules/oms/order-export-product-cells.ts`
- **inbound-orders-csv.util.ts** (12 connections) — `backend/src/modules/inbound/inbound-orders-csv.util.ts`
- **ClientOmsExportService** (11 connections) — `backend/src/modules/client-portal/order-export/client-oms-export.service.ts`
- **client-order-export.columns.ts** (11 connections) — `backend/src/modules/client-portal/order-export/client-order-export.columns.ts`
- **.exportCsv()** (11 connections) — `backend/src/modules/inbound/inbound-orders-csv.service.ts`
- **.validateGroups()** (11 connections) — `backend/src/modules/inbound/inbound-orders-csv.service.ts`
- **.exportCsv()** (11 connections) — `backend/src/modules/oms/oms-orders-csv.service.ts`
- **.exportCsv()** (11 connections) — `backend/src/modules/outbound/outbound-orders-csv.service.ts`
- **.exportCsv()** (10 connections) — `backend/src/modules/client-portal/order-export/client-oms-export.service.ts`
- **headerLabels()** (10 connections) — `backend/src/modules/client-portal/order-export/client-order-export.columns.ts`
- **orderedColumnIds()** (10 connections) — `backend/src/modules/client-portal/order-export/client-order-export.columns.ts`
- **.exportXlsx()** (10 connections) — `backend/src/modules/inbound/inbound-orders-csv.service.ts`
- *... and 106 more nodes in this community*

## Relationships

- [ClientPrincipal](ClientPrincipal.md) (39 shared connections)
- [oms-client-import.service.ts](oms-client-import.service.ts.md) (35 shared connections)
- [@nestjs/common](@nestjs-common.md) (31 shared connections)
- [AuthPrincipal](AuthPrincipal.md) (18 shared connections)
- [class-validator](class-validator.md) (17 shared connections)
- [outbound-orders-csv.service.ts](outbound-orders-csv.service.ts.md) (13 shared connections)
- [withTenantRls](withTenantRls.md) (11 shared connections)
- [.fromPrincipal](fromPrincipal.md) (10 shared connections)
- [client-oms-orders.service.ts](client-oms-orders.service.ts.md) (7 shared connections)
- [@prisma/client](@prisma-client.md) (6 shared connections)
- [ClientInboundOrdersController](ClientInboundOrdersController.md) (5 shared connections)
- [InboundController](InboundController.md) (5 shared connections)

## Source Files

- `backend/src/common/utils/excel-export.util.ts`
- `backend/src/common/utils/excel-export.util.unit.spec.ts`
- `backend/src/modules/client-portal/external-api/external-inbound.service.ts`
- `backend/src/modules/client-portal/inbound/client-inbound-orders.controller.ts`
- `backend/src/modules/client-portal/inbound/client-inbound-orders.service.ts`
- `backend/src/modules/client-portal/inbound/dto/client-inbound-export.dto.ts`
- `backend/src/modules/client-portal/oms/dto/bulk-confirm-client-oms-orders.dto.ts`
- `backend/src/modules/client-portal/order-export/client-inbound-export.service.ts`
- `backend/src/modules/client-portal/order-export/client-oms-export.service.ts`
- `backend/src/modules/client-portal/order-export/client-oms-export.service.unit.spec.ts`
- `backend/src/modules/client-portal/order-export/client-order-export.columns.ts`
- `backend/src/modules/client-portal/order-export/client-outbound-export.service.ts`
- `backend/src/modules/client-portal/outbound/client-outbound-orders.controller.ts`
- `backend/src/modules/client-portal/outbound/dto/client-outbound-export.dto.ts`
- `backend/src/modules/inbound/inbound-orders-csv.service.ts`
- `backend/src/modules/inbound/inbound-orders-csv.util.ts`
- `backend/src/modules/inbound/inbound-orders-csv.util.unit.spec.ts`
- `backend/src/modules/inbound/inbound.controller.ts`
- `backend/src/modules/inbound/inbound.service.ts`
- `backend/src/modules/oms/admin-order-export.columns.ts`

## Audit Trail

- EXTRACTED: 451 (92%)
- INFERRED: 41 (8%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*