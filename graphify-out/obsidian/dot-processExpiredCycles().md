---
source_file: "backend/src/modules/billing/billing-cycle-processor.service.ts"
type: "code"
community: "NotificationsService"
location: "L46"
tags:
  - graphify/code
  - graphify/INFERRED
  - community/NotificationsService
---

# .processExpiredCycles()

## Connections
- [[dot-createNextCycleFromPlan()]] - `calls` [INFERRED]
- [[dot-emitBillingRestrictionChanged()]] - `calls` [INFERRED]
- [[dot-emitCompanyLifecycleChanged()]] - `calls` [INFERRED]
- [[dot-emitInvoiceUpdated()]] - `calls` [INFERRED]
- [[dot-finalizeCycleInvoice()]] - `calls` [INFERRED]
- [[dot-notifyAccountRenewed()]] - `calls` [INFERRED]
- [[dot-notifyAccountSuspended()]] - `calls` [INFERRED]
- [[dot-notifyInvoiceGenerated()]] - `calls` [INFERRED]
- [[dot-recalculateForCompany()]] - `calls` [INFERRED]
- [[dot-runTick()_2]] - `calls` [EXTRACTED]
- [[dot-system()]] - `calls` [INFERRED]
- [[BillingCycleProcessorService]] - `method` [EXTRACTED]

#graphify/code #graphify/INFERRED #community/NotificationsService