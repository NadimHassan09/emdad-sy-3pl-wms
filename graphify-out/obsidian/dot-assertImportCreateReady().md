---
source_file: "backend/src/modules/inbound/inbound.service.ts"
type: "code"
community: "withTenantRls"
location: "L443"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/withTenantRls
---

# .assertImportCreateReady()

## Connections
- [[dot-assertOperationalBilling()]] - `calls` [INFERRED]
- [[dot-resolveWriteCompanyId()]] - `calls` [INFERRED]
- [[dot-validateGroups()_1]] - `calls` [INFERRED]
- [[AuthPrincipal]] - `references` [EXTRACTED]
- [[CreateInboundOrderDto]] - `references` [EXTRACTED]
- [[InboundService]] - `method` [EXTRACTED]
- [[assertCalendarDateNotBeforeToday()]] - `calls` [EXTRACTED]
- [[assertDiscreteUomPositiveIntegerQuantity()]] - `calls` [EXTRACTED]
- [[assertProductOrderableForOrders()]] - `calls` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/withTenantRls