---
source_file: "backend/src/modules/outbound/outbound-orders-csv.service.ts"
type: "code"
community: "outbound-orders-csv.service.ts"
location: "L1"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/outbound-orders-csvservicets
---

# outbound-orders-csv.service.ts

## Connections
- [[@nestjscommon]] - `imports_from` [EXTRACTED]
- [[@prismaclient]] - `imports_from` [EXTRACTED]
- [[ADMIN_OUTBOUND_EXPORT_COLUMNS]] - `imports` [EXTRACTED]
- [[AuthPrincipal]] - `imports` [EXTRACTED]
- [[CreateOutboundOrderDto]] - `imports` [EXTRACTED]
- [[ExcelExportColumn]] - `imports` [EXTRACTED]
- [[ListOutboundQueryDto]] - `imports` [EXTRACTED]
- [[OUTBOUND_EXPORT_MAX_ROWS]] - `contains` [EXTRACTED]
- [[OUTBOUND_IMPORT_MAX_ORDERS]] - `contains` [EXTRACTED]
- [[OUTBOUND_IMPORT_MAX_ROWS]] - `contains` [EXTRACTED]
- [[OutboundImportCsvHeader]] - `imports` [EXTRACTED]
- [[OutboundImportExecuteResult_1]] - `contains` [EXTRACTED]
- [[OutboundImportRowError_1]] - `contains` [EXTRACTED]
- [[OutboundImportValidateResult_1]] - `contains` [EXTRACTED]
- [[OutboundOrdersCsvService]] - `contains` [EXTRACTED]
- [[OutboundService]] - `imports` [EXTRACTED]
- [[ParsedOrderGroup]] - `contains` [EXTRACTED]
- [[admin-order-export.columns.ts]] - `imports_from` [EXTRACTED]
- [[adminHeaderLabels()]] - `imports` [EXTRACTED]
- [[adminOrderedColumnIds()]] - `imports` [EXTRACTED]
- [[assertDiscreteUomPositiveIntegerQuantity()]] - `imports` [EXTRACTED]
- [[buildExcelBuffer()]] - `imports` [EXTRACTED]
- [[cell()]] - `imports` [EXTRACTED]
- [[class-transformer]] - `imports_from` [EXTRACTED]
- [[class-validator]] - `imports_from` [EXTRACTED]
- [[create-outbound.dto.ts]] - `imports_from` [EXTRACTED]
- [[current-user.types.ts]] - `imports_from` [EXTRACTED]
- [[discrete-uom-quantity.ts]] - `imports_from` [EXTRACTED]
- [[excel-export.util.ts]] - `imports_from` [EXTRACTED]
- [[exportProductNames()]] - `imports` [EXTRACTED]
- [[exportProductWeights()]] - `imports` [EXTRACTED]
- [[getOutboundClientImportTemplate()]] - `imports` [EXTRACTED]
- [[list-outbound-query.dto.ts]] - `imports_from` [EXTRACTED]
- [[mapCsvHeaderRow()]] - `imports` [EXTRACTED]
- [[oms-client-import.validation.ts]] - `imports_from` [EXTRACTED]
- [[order-export-product-cells.ts]] - `imports_from` [EXTRACTED]
- [[outbound-client-import.schema.ts]] - `imports_from` [EXTRACTED]
- [[outbound-orders-csv.service.unit.spec.ts]] - `imports_from` [EXTRACTED]
- [[outbound-orders-csv.util.ts]] - `imports_from` [EXTRACTED]
- [[outbound.controller.ts]] - `imports_from` [EXTRACTED]
- [[outbound.module.ts]] - `imports_from` [EXTRACTED]
- [[outbound.service.ts]] - `imports_from` [EXTRACTED]
- [[outboundImportTemplateCsv()]] - `imports` [EXTRACTED]
- [[parseCsv()_1]] - `imports` [EXTRACTED]
- [[parseImportShipDateMdY()]] - `imports` [EXTRACTED]
- [[parseRequiresPacking()]] - `imports` [EXTRACTED]
- [[ref_node_crypto]] - `imports_from` [EXTRACTED]
- [[rowsToCsv()]] - `imports` [EXTRACTED]
- [[validateImportOrderNumber()]] - `imports` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/outbound-orders-csvservicets