---
source_file: "backend/src/modules/billing/billing-invoice-calculation.service.ts"
type: "code"
community: "BillingInvoiceCalculationService"
location: "L181"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/BillingInvoiceCalculationService
---

# .recalculateForCompanyInternal()

## Connections
- [[dot-applyInvoiceTotals()]] - `calls` [EXTRACTED]
- [[dot-collectCycleMetrics()]] - `calls` [EXTRACTED]
- [[dot-computeLines()]] - `calls` [EXTRACTED]
- [[dot-flushRecalc()]] - `calls` [EXTRACTED]
- [[dot-getOrCreateDraftInvoice()]] - `calls` [EXTRACTED]
- [[dot-logBestEffort()]] - `calls` [INFERRED]
- [[dot-resolveCycleRates()]] - `calls` [EXTRACTED]
- [[dot-syncOrderChargeLines()]] - `calls` [EXTRACTED]
- [[dot-upsertSystemInvoiceLine()]] - `calls` [EXTRACTED]
- [[BillingInvoiceCalculationService]] - `method` [EXTRACTED]
- [[BillingRecalcResult]] - `references` [EXTRACTED]
- [[BillingRecalcTrigger]] - `references` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/BillingInvoiceCalculationService