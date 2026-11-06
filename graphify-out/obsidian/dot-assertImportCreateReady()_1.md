---
source_file: "backend/src/modules/oms/oms-orders.service.ts"
type: "code"
community: "withTenantRls"
location: "L448"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/withTenantRls
---

# .assertImportCreateReady()

## Connections
- [[dot-assertOperationalBilling()]] - `calls` [INFERRED]
- [[dot-assertOutboundLinkable()]] - `calls` [EXTRACTED]
- [[dot-resolveWriteCompanyId()]] - `calls` [INFERRED]
- [[dot-validateGroups()_2]] - `calls` [INFERRED]
- [[AuthPrincipal]] - `references` [EXTRACTED]
- [[CreateOmsOrderDto]] - `references` [EXTRACTED]
- [[OmsOrdersService]] - `method` [EXTRACTED]
- [[assertAndNormalizeRecipientContact()]] - `calls` [EXTRACTED]
- [[assertCalendarDateNotBeforeToday()]] - `calls` [EXTRACTED]
- [[assertDiscreteUomPositiveIntegerQuantity()]] - `calls` [EXTRACTED]
- [[assertOmsCreatePaymentMethodRequired()]] - `calls` [EXTRACTED]
- [[assertProductOrderableForOrders()]] - `calls` [EXTRACTED]
- [[assertShippingIntentReady()]] - `calls` [EXTRACTED]
- [[composeDestinationAddress()]] - `calls` [EXTRACTED]
- [[resolveOmsDeliveryLocation()]] - `calls` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/withTenantRls