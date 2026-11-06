---
source_file: "backend/src/modules/billing/billing-plans.service.ts"
type: "code"
community: "BillingInvoiceCalculationService"
location: "L64"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/BillingInvoiceCalculationService
---

# .listPage()

## Connections
- [[dot-assertCompanyAccess()]] - `calls` [INFERRED]
- [[dot-listPlans()]] - `calls` [INFERRED]
- [[AuthPrincipal]] - `references` [EXTRACTED]
- [[BillingPlansService]] - `method` [EXTRACTED]
- [[ListBillingPlansQueryDto]] - `references` [EXTRACTED]
- [[billingPlansOverviewCountSql()]] - `calls` [EXTRACTED]
- [[billingPlansOverviewListSql()]] - `calls` [EXTRACTED]
- [[mapOverviewSqlRow()]] - `indirect_call` [INFERRED]

#graphify/code #graphify/EXTRACTED #community/BillingInvoiceCalculationService