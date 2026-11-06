---
source_file: "backend/src/modules/billing/billing-plans.service.ts"
type: "code"
community: "BillingInvoiceCalculationService"
location: "L286"
tags:
  - graphify/code
  - graphify/INFERRED
  - community/BillingInvoiceCalculationService
---

# .renew()

## Connections
- [[dot-emitBillingRestrictionChanged()]] - `calls` [INFERRED]
- [[dot-emitCompanyLifecycleChanged()]] - `calls` [INFERRED]
- [[dot-emitPlanUpdated()]] - `calls` [INFERRED]
- [[dot-findById()_8]] - `calls` [EXTRACTED]
- [[dot-fromUser()]] - `calls` [INFERRED]
- [[dot-notifyAccountRenewed()]] - `calls` [INFERRED]
- [[dot-recalculateForCompany()]] - `calls` [INFERRED]
- [[dot-renewPlan()]] - `calls` [INFERRED]
- [[AuthPrincipal]] - `references` [EXTRACTED]
- [[BillingPlansService]] - `method` [EXTRACTED]
- [[InvalidStateException]] - `calls` [EXTRACTED]
- [[buildRateSnapshotFromPlan()]] - `calls` [EXTRACTED]

#graphify/code #graphify/INFERRED #community/BillingInvoiceCalculationService