---
type: community
cohesion: 0.04
members: 89
---

# BillingInvoiceCalculationService

**Cohesion:** 0.04 - loosely connected
**Members:** 89 nodes

## Members
- [[dot-assertVolumeAllocation()]] - code - backend/src/modules/billing/billing-access.service.ts
- [[dot-assertWeightAllocation()]] - code - backend/src/modules/billing/billing-access.service.ts
- [[dot-buildUtilizationSnapshot()]] - code - backend/src/modules/billing/billing-usage.service.ts
- [[dot-collectCycleMetrics()]] - code - backend/src/modules/billing/billing-invoice-calculation.service.ts
- [[dot-computeLines()]] - code - backend/src/modules/billing/billing-invoice-calculation.service.ts
- [[dot-computeSystemLines()]] - code - backend/src/modules/billing/billing-invoice-calculation.service.ts
- [[dot-constructor()_157]] - code - backend/src/modules/billing/billing-access.service.ts
- [[dot-constructor()_158]] - code - backend/src/modules/billing/billing.controller.ts
- [[dot-constructor()_159]] - code - backend/src/modules/billing/billing-plans.service.ts
- [[dot-constructor()_160]] - code - backend/src/modules/billing/billing-preview.service.ts
- [[dot-constructor()_161]] - code - backend/src/modules/billing/billing-usage.service.ts
- [[dot-constructor()_162]] - code - backend/src/modules/billing/order-manual-charges.service.ts
- [[dot-constructor()_163]] - code - backend/src/modules/client-portal/billing/client-billing.service.ts
- [[dot-create()_17]] - code - backend/src/modules/billing/billing-plans.service.ts
- [[dot-createNextCycleFromPlan()]] - code - backend/src/modules/billing/billing-cycles.service.ts
- [[dot-finalizeCycleInvoice()]] - code - backend/src/modules/billing/billing-invoice-calculation.service.ts
- [[dot-findById()_7]] - code - backend/src/modules/billing/billing-cycles.service.ts
- [[dot-findById()_8]] - code - backend/src/modules/billing/billing-plans.service.ts
- [[dot-flushRecalc()]] - code - backend/src/modules/billing/billing-invoice-calculation.service.ts
- [[dot-fromUser()]] - code - backend/src/modules/billing/billing-audit.service.ts
- [[dot-getAllocatedVolume()]] - code - backend/src/modules/billing/billing-access.service.ts
- [[dot-getAllocatedWeight()]] - code - backend/src/modules/billing/billing-access.service.ts
- [[dot-getCapacitySummary()]] - code - backend/src/modules/billing/billing-plans.service.ts
- [[dot-getCompanyPreview()]] - code - backend/src/modules/billing/billing-preview.service.ts
- [[dot-getCompanyReservedStorageCbm()]] - code - backend/src/modules/billing/billing-usage.service.ts
- [[dot-getCompanyStorageSnapshot()]] - code - backend/src/modules/billing/billing-usage.service.ts
- [[dot-getCompanyStorageSummary()]] - code - backend/src/modules/billing/billing-plans.service.ts
- [[dot-getCompanyUsage()]] - code - backend/src/modules/billing/billing-usage.service.ts
- [[dot-getOrCreateDraftInvoice()]] - code - backend/src/modules/billing/billing-invoice-calculation.service.ts
- [[dot-getSystemReservedStorageCbm()]] - code - backend/src/modules/billing/billing-usage.service.ts
- [[dot-getSystemStorageSnapshot()]] - code - backend/src/modules/billing/billing-usage.service.ts
- [[dot-getSystemUsedStorageCbm()]] - code - backend/src/modules/billing/billing-usage.service.ts
- [[dot-getTotalWarehouseVolume()]] - code - backend/src/modules/billing/billing-access.service.ts
- [[dot-getTotalWarehouseWeight()]] - code - backend/src/modules/billing/billing-access.service.ts
- [[dot-listPage()_1]] - code - backend/src/modules/billing/billing-plans.service.ts
- [[dot-recalculateForCompany()]] - code - backend/src/modules/billing/billing-invoice-calculation.service.ts
- [[dot-recalculateForCompanyInternal()]] - code - backend/src/modules/billing/billing-invoice-calculation.service.ts
- [[dot-renew()]] - code - backend/src/modules/billing/billing-cycles.service.ts
- [[dot-renew()_1]] - code - backend/src/modules/billing/billing-plans.service.ts
- [[dot-resolveCycleRates()]] - code - backend/src/modules/billing/billing-invoice-calculation.service.ts
- [[dot-runTick()_1]] - code - backend/src/modules/billing/billing-usage-processor.service.ts
- [[dot-syncOrderChargeLines()]] - code - backend/src/modules/billing/billing-invoice-calculation.service.ts
- [[dot-tick()_1]] - code - backend/src/modules/billing/billing-usage-processor.service.ts
- [[dot-update()_6]] - code - backend/src/modules/billing/billing-plans.service.ts
- [[dot-upsertSystemInvoiceLine()]] - code - backend/src/modules/billing/billing-invoice-calculation.service.ts
- [[ALL_BILLING_LINE_TYPES]] - code - backend/src/modules/billing/billing-recalculation.types.ts
- [[BillingCyclesService]] - code - backend/src/modules/billing/billing-cycles.service.ts
- [[BillingInvoiceCalculationService]] - code - backend/src/modules/billing/billing-invoice-calculation.service.ts
- [[BillingLineComputation]] - code - backend/src/modules/billing/billing-recalculation.types.ts
- [[BillingPlanOverviewSqlRow]] - code - backend/src/modules/billing/billing-plans-list.query.ts
- [[BillingPlansService]] - code - backend/src/modules/billing/billing-plans.service.ts
- [[BillingPreviewService]] - code - backend/src/modules/billing/billing-preview.service.ts
- [[BillingRateSnapshot]] - code - backend/src/modules/billing/billing-rate-snapshot.util.ts
- [[BillingRecalcResult]] - code - backend/src/modules/billing/billing-recalculation.types.ts
- [[BillingRecalcTrigger]] - code - backend/src/modules/billing/billing-recalculation.types.ts
- [[BillingUsageService]] - code - backend/src/modules/billing/billing-usage.service.ts
- [[BillingVolumeCapacityService]] - code - backend/src/modules/billing/billing-access.service.ts
- [[Cron_2]] - code
- [[CycleOrderMetrics]] - code - backend/src/modules/billing/billing-invoice-calculation.service.ts
- [[Injectable_101]] - code
- [[Injectable_102]] - code
- [[Injectable_103]] - code
- [[Injectable_104]] - code
- [[Injectable_105]] - code
- [[Injectable_106]] - code
- [[InvoiceTotalsInput]] - code - backend/src/modules/billing/billing-totals.util.ts
- [[PLAN_RATE_SELECT_1]] - code - backend/src/modules/billing/billing-invoice-calculation.service.ts
- [[PlanRateSource]] - code - backend/src/modules/billing/billing-rate-snapshot.util.ts
- [[RETIRED_USAGE_LINE_TYPES]] - code - backend/src/modules/billing/billing-invoice-calculation.service.ts
- [[SORT_COLUMNS]] - code - backend/src/modules/billing/billing-plans-list.query.ts
- [[SYSTEM_LINE_TYPES]] - code - backend/src/modules/billing/billing-invoice-calculation.service.ts
- [[billing-invoice-calculation.service.ts]] - code - backend/src/modules/billing/billing-invoice-calculation.service.ts
- [[billing-invoice-calculation.unit.spec.ts]] - code - backend/src/modules/billing/billing-invoice-calculation.unit.spec.ts
- [[billing-plans-list.query.ts]] - code - backend/src/modules/billing/billing-plans-list.query.ts
- [[billing-rate-snapshot.util.ts]] - code - backend/src/modules/billing/billing-rate-snapshot.util.ts
- [[billing-recalculation-triggers.util.ts]] - code - backend/src/modules/billing/billing-recalculation-triggers.util.ts
- [[billing-recalculation.types.ts]] - code - backend/src/modules/billing/billing-recalculation.types.ts
- [[billing-totals.util.ts]] - code - backend/src/modules/billing/billing-totals.util.ts
- [[billingPlansOverviewCountSql()]] - code - backend/src/modules/billing/billing-plans-list.query.ts
- [[billingPlansOverviewListSql()]] - code - backend/src/modules/billing/billing-plans-list.query.ts
- [[billingTriggerForWarehouseTask()]] - code - backend/src/modules/billing/billing-recalculation-triggers.util.ts
- [[buildPlansOverviewWhere()]] - code - backend/src/modules/billing/billing-plans-list.query.ts
- [[buildRateSnapshotFromPlan()]] - code - backend/src/modules/billing/billing-rate-snapshot.util.ts
- [[computeInvoiceTotals()_1]] - code - backend/src/modules/billing/billing-totals.util.ts
- [[mapOverviewSqlRow()]] - code - backend/src/modules/billing/billing-plans.service.ts
- [[parseRateSnapshot()]] - code - backend/src/modules/billing/billing-rate-snapshot.util.ts
- [[rateSnapshotToDecimals()]] - code - backend/src/modules/billing/billing-rate-snapshot.util.ts
- [[rates()]] - code - backend/src/modules/billing/billing-invoice-calculation.unit.spec.ts
- [[sumLineTotals()]] - code - backend/src/modules/billing/billing-totals.util.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/BillingInvoiceCalculationService
SORT file.name ASC
```

## Connections to other communities
- 70 edges to [[_COMMUNITY_@prismaclient]]
- 25 edges to [[_COMMUNITY_BillingController]]
- 10 edges to [[_COMMUNITY_AuthPrincipal]]
- 7 edges to [[_COMMUNITY_outbound.service.ts]]
- 7 edges to [[_COMMUNITY_dot-assertCompanyAccess]]
- 6 edges to [[_COMMUNITY_NotificationsService]]
- 6 edges to [[_COMMUNITY_RealtimeService]]
- 5 edges to [[_COMMUNITY_ClientBillingService]]
- 4 edges to [[_COMMUNITY_warehouse-tasks.service.ts]]
- 4 edges to [[_COMMUNITY_AuditLogService]]
- 3 edges to [[_COMMUNITY_task-inventory-effects.service.ts]]
- 3 edges to [[_COMMUNITY_dashboard.service.ts]]
- 3 edges to [[_COMMUNITY_EmptyToUndefined]]
- 2 edges to [[_COMMUNITY_WarehouseTasksService]]
- 1 edge to [[_COMMUNITY_UpdateBillingPlanDto]]
- 1 edge to [[_COMMUNITY_grn-pdf.service.ts]]
- 1 edge to [[_COMMUNITY_CreateBillingPlanDto]]
- 1 edge to [[_COMMUNITY_RedisService]]
- 1 edge to [[_COMMUNITY_dot-fromPrincipal]]
- 1 edge to [[_COMMUNITY_withTenantRls]]
- 1 edge to [[_COMMUNITY_@nestjscommon]]

## Top bridge nodes
- [[BillingInvoiceCalculationService]] - degree 33, connects to 7 communities
- [[billing-invoice-calculation.service.ts]] - degree 31, connects to 5 communities
- [[dot-recalculateForCompany()]] - degree 16, connects to 5 communities
- [[dot-renew()_1]] - degree 12, connects to 5 communities
- [[dot-create()_17]] - degree 11, connects to 5 communities