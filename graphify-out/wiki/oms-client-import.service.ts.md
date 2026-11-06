# oms-client-import.service.ts

> 111 nodes · cohesion 0.05

## Key Concepts

- **oms-client-import.service.ts** (49 connections) — `backend/src/modules/client-portal/order-import/oms-client-import.service.ts`
- **oms-orders-csv.service.ts** (48 connections) — `backend/src/modules/oms/oms-orders-csv.service.ts`
- **inbound-client-import.service.ts** (37 connections) — `backend/src/modules/client-portal/order-import/inbound-client-import.service.ts`
- **outbound-client-import.service.ts** (36 connections) — `backend/src/modules/client-portal/order-import/outbound-client-import.service.ts`
- **oms-client-import.validation.ts** (33 connections) — `backend/src/modules/client-portal/order-import/oms-client-import.validation.ts`
- **.importFileForCompany()** (24 connections) — `backend/src/modules/client-portal/order-import/oms-client-import.service.ts`
- **order-import.grouping.ts** (22 connections) — `backend/src/modules/client-portal/order-import/order-import.grouping.ts`
- **oms-orders-csv.util.ts** (22 connections) — `backend/src/modules/oms/oms-orders-csv.util.ts`
- **rowsToCsv()** (20 connections) — `backend/src/modules/oms/oms-orders-csv.util.ts`
- **validateImportOrderNumber()** (19 connections) — `backend/src/modules/client-portal/order-import/oms-client-import.validation.ts`
- **.importFileForCompany()** (17 connections) — `backend/src/modules/client-portal/order-import/inbound-client-import.service.ts`
- **.importFileForCompany()** (17 connections) — `backend/src/modules/client-portal/order-import/outbound-client-import.service.ts`
- **order-import.grouping.unit.spec.ts** (16 connections) — `backend/src/modules/client-portal/order-import/order-import.grouping.unit.spec.ts`
- **spreadsheet.parse.ts** (16 connections) — `backend/src/modules/client-portal/order-import/spreadsheet.parse.ts`
- **OmsOrdersCsvService** (16 connections) — `backend/src/modules/oms/oms-orders-csv.service.ts`
- **client-import-template.unit.spec.ts** (14 connections) — `backend/src/modules/client-portal/order-import/client-import-template.unit.spec.ts`
- **oms-client-import.schema.ts** (14 connections) — `backend/src/modules/client-portal/order-import/oms-client-import.schema.ts`
- **order-planning-date.ts** (12 connections) — `backend/src/common/utils/order-planning-date.ts`
- **calendarTodayYmdServerLocal()** (12 connections) — `backend/src/common/utils/order-planning-date.ts`
- **inbound-client-import.schema.ts** (12 connections) — `backend/src/modules/client-portal/order-import/inbound-client-import.schema.ts`
- **assertImportTable()** (12 connections) — `backend/src/modules/client-portal/order-import/order-import.grouping.ts`
- **outbound-client-import.schema.ts** (12 connections) — `backend/src/modules/client-portal/order-import/outbound-client-import.schema.ts`
- **InboundClientImportService** (11 connections) — `backend/src/modules/client-portal/order-import/inbound-client-import.service.ts`
- **OmsClientImportService** (11 connections) — `backend/src/modules/client-portal/order-import/oms-client-import.service.ts`
- **parseImportMdYDate()** (11 connections) — `backend/src/modules/client-portal/order-import/oms-client-import.validation.ts`
- *... and 86 more nodes in this community*

## Relationships

- [inbound-orders-csv.service.ts](inbound-orders-csv.service.ts.md) (35 shared connections)
- [@nestjs/common](@nestjs-common.md) (33 shared connections)
- [client-oms-orders.service.ts](client-oms-orders.service.ts.md) (26 shared connections)
- [withTenantRls](withTenantRls.md) (25 shared connections)
- [validators/recipient-contact.ts](validators-recipient-contact.ts.md) (18 shared connections)
- [ClientPrincipal](ClientPrincipal.md) (17 shared connections)
- [@prisma/client](@prisma-client.md) (12 shared connections)
- [task-inventory-effects.service.ts](task-inventory-effects.service.ts.md) (11 shared connections)
- [outbound-orders-csv.service.ts](outbound-orders-csv.service.ts.md) (11 shared connections)
- [AuthPrincipal](AuthPrincipal.md) (10 shared connections)
- [outbound.service.ts](outbound.service.ts.md) (7 shared connections)
- [CreateOmsOrderDto](CreateOmsOrderDto.md) (4 shared connections)

## Source Files

- `backend/src/common/utils/order-planning-date.ts`
- `backend/src/common/validators/recipient-contact.ts`
- `backend/src/modules/client-portal/order-import/client-import-template.unit.spec.ts`
- `backend/src/modules/client-portal/order-import/inbound-client-import.schema.ts`
- `backend/src/modules/client-portal/order-import/inbound-client-import.service.ts`
- `backend/src/modules/client-portal/order-import/oms-client-import.schema.ts`
- `backend/src/modules/client-portal/order-import/oms-client-import.service.ts`
- `backend/src/modules/client-portal/order-import/oms-client-import.validation.ts`
- `backend/src/modules/client-portal/order-import/oms-client-import.validation.unit.spec.ts`
- `backend/src/modules/client-portal/order-import/order-import.grouping.ts`
- `backend/src/modules/client-portal/order-import/order-import.grouping.unit.spec.ts`
- `backend/src/modules/client-portal/order-import/order-import.limits.ts`
- `backend/src/modules/client-portal/order-import/order-import.types.ts`
- `backend/src/modules/client-portal/order-import/outbound-client-import.schema.ts`
- `backend/src/modules/client-portal/order-import/outbound-client-import.service.ts`
- `backend/src/modules/client-portal/order-import/spreadsheet.parse.ts`
- `backend/src/modules/oms/oms-orders-csv.service.ts`
- `backend/src/modules/oms/oms-orders-csv.service.unit.spec.ts`
- `backend/src/modules/oms/oms-orders-csv.util.ts`
- `backend/src/modules/oms/oms-orders-csv.util.unit.spec.ts`

## Audit Trail

- EXTRACTED: 513 (95%)
- INFERRED: 26 (5%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*