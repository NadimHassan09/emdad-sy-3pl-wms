---
source_file: "backend/src/modules/billing/order-manual-charges.service.ts"
type: "code"
community: "BillingController"
location: "L46"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/BillingController
---

# .create()

## Connections
- [[dot-assertCompanyAccess()]] - `calls` [INFERRED]
- [[dot-createOrderCharge()]] - `calls` [INFERRED]
- [[dot-recalculateForCompany()]] - `calls` [INFERRED]
- [[dot-resolveReferenceCompanyId()]] - `calls` [EXTRACTED]
- [[AuthPrincipal]] - `references` [EXTRACTED]
- [[CreateOrderManualChargeDto]] - `references` [EXTRACTED]
- [[OrderManualChargesService]] - `method` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/BillingController