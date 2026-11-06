---
source_file: "backend/src/modules/billing/billing-invoice-calculation.service.ts"
type: "code"
community: "BillingInvoiceCalculationService"
location: "L1"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/BillingInvoiceCalculationService
---

# billing-invoice-calculation.service.ts

## Connections
- [[@nestjscommon]] - `imports_from` [EXTRACTED]
- [[@prismaclient]] - `imports_from` [EXTRACTED]
- [[AuditLogService]] - `imports` [EXTRACTED]
- [[BillingInvoiceCalculationService]] - `contains` [EXTRACTED]
- [[BillingLineComputation]] - `imports` [EXTRACTED]
- [[BillingRecalcResult]] - `imports` [EXTRACTED]
- [[BillingRecalcTrigger]] - `imports` [EXTRACTED]
- [[CycleOrderMetrics]] - `contains` [EXTRACTED]
- [[PLAN_RATE_SELECT_1]] - `contains` [EXTRACTED]
- [[PrismaService]] - `imports` [EXTRACTED]
- [[RETIRED_USAGE_LINE_TYPES]] - `contains` [EXTRACTED]
- [[SYSTEM_LINE_TYPES]] - `contains` [EXTRACTED]
- [[audit-log.service.ts]] - `imports_from` [EXTRACTED]
- [[billing-cycle-processor.service.ts]] - `imports_from` [EXTRACTED]
- [[billing-invoice-calculation.unit.spec.ts]] - `imports_from` [EXTRACTED]
- [[billing-invoices.service.ts]] - `imports_from` [EXTRACTED]
- [[billing-plans.service.ts]] - `imports_from` [EXTRACTED]
- [[billing-preview.service.ts]] - `imports_from` [EXTRACTED]
- [[billing-rate-snapshot.util.ts]] - `imports_from` [EXTRACTED]
- [[billing-recalculation.types.ts]] - `imports_from` [EXTRACTED]
- [[billing-totals.util.ts]] - `imports_from` [EXTRACTED]
- [[billing-usage-processor.service.ts]] - `imports_from` [EXTRACTED]
- [[billing.module.ts]] - `imports_from` [EXTRACTED]
- [[computeInvoiceTotals()_1]] - `imports` [EXTRACTED]
- [[order-manual-charges.service.ts]] - `imports_from` [EXTRACTED]
- [[outbound.service.ts]] - `imports_from` [EXTRACTED]
- [[parseRateSnapshot()]] - `imports` [EXTRACTED]
- [[prisma.service.ts]] - `imports_from` [EXTRACTED]
- [[rateSnapshotToDecimals()]] - `imports` [EXTRACTED]
- [[sumLineTotals()]] - `imports` [EXTRACTED]
- [[warehouse-tasks.service.ts]] - `imports_from` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/BillingInvoiceCalculationService