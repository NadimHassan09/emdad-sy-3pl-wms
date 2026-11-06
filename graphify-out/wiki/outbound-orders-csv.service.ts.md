# outbound-orders-csv.service.ts

> 33 nodes · cohesion 0.11

## Key Concepts

- **outbound-orders-csv.service.ts** (49 connections) — `backend/src/modules/outbound/outbound-orders-csv.service.ts`
- **OutboundOrdersCsvService** (16 connections) — `backend/src/modules/outbound/outbound-orders-csv.service.ts`
- **outbound-orders-csv.util.ts** (13 connections) — `backend/src/modules/outbound/outbound-orders-csv.util.ts`
- **.validateGroups()** (12 connections) — `backend/src/modules/outbound/outbound-orders-csv.service.ts`
- **.findByExternalReference()** (7 connections) — `backend/src/modules/outbound/outbound.service.ts`
- **.parseAndGroup()** (6 connections) — `backend/src/modules/outbound/outbound-orders-csv.service.ts`
- **rowsToCsv()** (6 connections) — `backend/src/modules/outbound/outbound-orders-csv.util.ts`
- **outbound-orders-csv.util.unit.spec.ts** (6 connections) — `backend/src/modules/outbound/outbound-orders-csv.util.unit.spec.ts`
- **.constructor()** (5 connections) — `backend/src/modules/outbound/outbound.controller.ts`
- **.executeImport()** (5 connections) — `backend/src/modules/outbound/outbound-orders-csv.service.ts`
- **mapCsvHeaderRow()** (5 connections) — `backend/src/modules/outbound/outbound-orders-csv.util.ts`
- **.validateImport()** (4 connections) — `backend/src/modules/outbound/outbound-orders-csv.service.ts`
- **outboundImportTemplateCsv()** (4 connections) — `backend/src/modules/outbound/outbound-orders-csv.util.ts`
- **parseCsv()** (4 connections) — `backend/src/modules/outbound/outbound-orders-csv.util.ts`
- **parseRequiresPacking()** (4 connections) — `backend/src/modules/outbound/outbound-orders-csv.util.ts`
- **cell()** (3 connections) — `backend/src/modules/outbound/outbound-orders-csv.util.ts`
- **csvEscape()** (3 connections) — `backend/src/modules/outbound/outbound-orders-csv.util.ts`
- **.findProductsBySkus()** (3 connections) — `backend/src/modules/outbound/outbound.service.ts`
- **.constructor()** (2 connections) — `backend/src/modules/outbound/outbound-orders-csv.service.ts`
- **.getImportTemplate()** (2 connections) — `backend/src/modules/outbound/outbound-orders-csv.service.ts`
- **.getLegacyImportTemplate()** (2 connections) — `backend/src/modules/outbound/outbound-orders-csv.service.ts`
- **normalizeHeader()** (2 connections) — `backend/src/modules/outbound/outbound-orders-csv.util.ts`
- **OutboundImportCsvHeader** (2 connections) — `backend/src/modules/outbound/outbound-orders-csv.util.ts`
- **OUTBOUND_EXPORT_MAX_ROWS** (1 connections) — `backend/src/modules/outbound/outbound-orders-csv.service.ts`
- **OUTBOUND_IMPORT_MAX_ORDERS** (1 connections) — `backend/src/modules/outbound/outbound-orders-csv.service.ts`
- *... and 8 more nodes in this community*

## Relationships

- [inbound-orders-csv.service.ts](inbound-orders-csv.service.ts.md) (13 shared connections)
- [oms-client-import.service.ts](oms-client-import.service.ts.md) (11 shared connections)
- [withTenantRls](withTenantRls.md) (9 shared connections)
- [AuthPrincipal](AuthPrincipal.md) (8 shared connections)
- [task-inventory-effects.service.ts](task-inventory-effects.service.ts.md) (3 shared connections)
- [@nestjs/common](@nestjs-common.md) (3 shared connections)
- [class-validator](class-validator.md) (3 shared connections)
- [outbound.service.ts](outbound.service.ts.md) (3 shared connections)
- [app.module.ts](app.module.ts.md) (2 shared connections)
- [@prisma/client](@prisma-client.md) (2 shared connections)
- [CreateOutboundOrderDto](CreateOutboundOrderDto.md) (1 shared connections)
- [ListOutboundQueryDto](ListOutboundQueryDto.md) (1 shared connections)

## Source Files

- `backend/src/modules/outbound/outbound-orders-csv.service.ts`
- `backend/src/modules/outbound/outbound-orders-csv.util.ts`
- `backend/src/modules/outbound/outbound-orders-csv.util.unit.spec.ts`
- `backend/src/modules/outbound/outbound.controller.ts`
- `backend/src/modules/outbound/outbound.service.ts`

## Audit Trail

- EXTRACTED: 110 (92%)
- INFERRED: 9 (8%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*