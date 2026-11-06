---
source_file: "backend/src/modules/products/products.service.ts"
type: "code"
community: "AuditLogService"
location: "L1"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/AuditLogService
---

# products.service.ts

## Connections
- [[@nestjscommon]] - `imports_from` [EXTRACTED]
- [[@prismaclient]] - `imports_from` [EXTRACTED]
- [[AuditLogService]] - `imports` [EXTRACTED]
- [[AuthPrincipal]] - `imports` [EXTRACTED]
- [[BillingAccessService]] - `imports` [EXTRACTED]
- [[CompanyAccessService]] - `imports` [EXTRACTED]
- [[CreateProductDto]] - `imports` [EXTRACTED]
- [[ExcelExportColumn]] - `imports` [EXTRACTED]
- [[INTERNAL_ROLES]] - `contains` [EXTRACTED]
- [[ListProductsQueryDto]] - `imports` [EXTRACTED]
- [[PrismaService]] - `imports` [EXTRACTED]
- [[ProductAuditSnapshot]] - `imports` [EXTRACTED]
- [[ProductsService]] - `contains` [EXTRACTED]
- [[RealtimeService]] - `imports` [EXTRACTED]
- [[UpdateProductDto]] - `imports` [EXTRACTED]
- [[assertCompanyBarcodeAvailable()]] - `imports` [EXTRACTED]
- [[audit-log.service.ts]] - `imports_from` [EXTRACTED]
- [[audit-mutations.integration.ts]] - `imports_from` [EXTRACTED]
- [[avatar-url.ts]] - `imports_from` [EXTRACTED]
- [[barcodeChanged()]] - `imports` [EXTRACTED]
- [[billing-access.service.ts]] - `imports_from` [EXTRACTED]
- [[buildExcelBuffer()]] - `imports` [EXTRACTED]
- [[client-products.service.ts]] - `imports_from` [EXTRACTED]
- [[coerce-boolean.ts]] - `imports_from` [EXTRACTED]
- [[coerceOptionalBool()]] - `imports` [EXTRACTED]
- [[company-access.service.ts]] - `imports_from` [EXTRACTED]
- [[company-read-scope.ts]] - `imports_from` [EXTRACTED]
- [[create-product.dto.ts]] - `imports_from` [EXTRACTED]
- [[current-user.types.ts]] - `imports_from` [EXTRACTED]
- [[excel-export.util.ts]] - `imports_from` [EXTRACTED]
- [[generateBarcodeCandidate()]] - `imports` [EXTRACTED]
- [[generateSkuCandidate()]] - `imports` [EXTRACTED]
- [[generatorsidentifiers.ts]] - `imports_from` [EXTRACTED]
- [[inboundLinesBlockingProductDeleteWhere()]] - `imports` [EXTRACTED]
- [[list-products-query.dto.ts]] - `imports_from` [EXTRACTED]
- [[normalizeProductBarcode()]] - `imports` [EXTRACTED]
- [[omsLinesBlockingProductDeleteWhere()]] - `imports` [EXTRACTED]
- [[outboundLinesBlockingProductDeleteWhere()]] - `imports` [EXTRACTED]
- [[prisma.service.ts]] - `imports_from` [EXTRACTED]
- [[product-audit.util.ts]] - `imports_from` [EXTRACTED]
- [[product-barcode.util.ts]] - `imports_from` [EXTRACTED]
- [[product-delete-references.util.ts]] - `imports_from` [EXTRACTED]
- [[product-volume.util.ts]] - `imports_from` [EXTRACTED]
- [[productAuditSnapshot()]] - `imports` [EXTRACTED]
- [[productRealtimePayload()]] - `imports` [EXTRACTED]
- [[products-barcode.integration.ts]] - `imports_from` [EXTRACTED]
- [[products.controller.ts]] - `imports_from` [EXTRACTED]
- [[products.module.ts]] - `imports_from` [EXTRACTED]
- [[products.service.unit.spec.ts]] - `imports_from` [EXTRACTED]
- [[purgeRemovableOrderLinesForProduct()]] - `imports` [EXTRACTED]
- [[readCompanyIdCatalogFilter()]] - `imports` [EXTRACTED]
- [[realtime-master-data.payload.ts]] - `imports_from` [EXTRACTED]
- [[realtime.service.ts]] - `imports_from` [EXTRACTED]
- [[resolveProductVolumeCbmFromDims()]] - `imports` [EXTRACTED]
- [[toAvatarPublicUrl()]] - `imports` [EXTRACTED]
- [[update-product.dto.ts]] - `imports_from` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/AuditLogService