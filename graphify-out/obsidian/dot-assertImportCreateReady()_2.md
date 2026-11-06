---
source_file: "backend/src/modules/outbound/outbound.service.ts"
type: "code"
community: "withTenantRls"
location: "L854"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/withTenantRls
---

# .assertImportCreateReady()

## Connections
- [[dot-assertOperationalBilling()]] - `calls` [INFERRED]
- [[dot-assertSufficientStockForLines()_1]] - `calls` [EXTRACTED]
- [[dot-resolveWriteCompanyId()]] - `calls` [INFERRED]
- [[dot-validateGroups()]] - `calls` [INFERRED]
- [[AuthPrincipal]] - `references` [EXTRACTED]
- [[CreateOutboundOrderDto]] - `references` [EXTRACTED]
- [[OutboundService]] - `method` [EXTRACTED]
- [[assertCalendarDateNotBeforeToday()]] - `calls` [EXTRACTED]
- [[assertDiscreteUomPositiveIntegerQuantity()]] - `calls` [EXTRACTED]
- [[assertProductOrderableForOrders()]] - `calls` [EXTRACTED]
- [[assertShippingIntentReady()]] - `calls` [EXTRACTED]
- [[resolveShippingVolumeCbm()]] - `calls` [EXTRACTED]
- [[resolveShippingWeightKg()]] - `calls` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/withTenantRls