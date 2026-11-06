---
source_file: "backend/src/modules/cycle-count/cycle-count.service.ts"
type: "code"
community: "cycle-count.service.ts"
location: "L1"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/cycle-countservicets
---

# cycle-count.service.ts

## Connections
- [[@nestjscommon]] - `imports_from` [EXTRACTED]
- [[@prismaclient]] - `imports_from` [EXTRACTED]
- [[AssignCycleCountDto]] - `imports` [EXTRACTED]
- [[AssignCycleCountLineDto]] - `imports` [EXTRACTED]
- [[AuditLogService]] - `imports` [EXTRACTED]
- [[AuthPrincipal]] - `imports` [EXTRACTED]
- [[COUNT_DETAIL_INCLUDE]] - `contains` [EXTRACTED]
- [[CYCLE_COUNT_ACTIVE_STATUSES]] - `imports` [EXTRACTED]
- [[CompanyAccessService]] - `imports` [EXTRACTED]
- [[CreateCycleCountDto]] - `imports` [EXTRACTED]
- [[CycleCountLineMutationService]] - `imports` [EXTRACTED]
- [[CycleCountService]] - `contains` [EXTRACTED]
- [[CycleCountSnapshotService]] - `imports` [EXTRACTED]
- [[CycleCountVarianceDetectionService]] - `imports` [EXTRACTED]
- [[CycleCountVarianceService]] - `imports` [EXTRACTED]
- [[InvalidStateException]] - `imports` [EXTRACTED]
- [[ListCycleCountsQueryDto]] - `imports` [EXTRACTED]
- [[ListProductHistoryQueryDto]] - `imports` [EXTRACTED]
- [[PrismaService]] - `imports` [EXTRACTED]
- [[RealtimeService]] - `imports` [EXTRACTED]
- [[SCHEDULE_INCLUDE]] - `contains` [EXTRACTED]
- [[SkipCycleCountLineDto]] - `imports` [EXTRACTED]
- [[SubmitLineCountDto]] - `imports` [EXTRACTED]
- [[UpsertCycleCountScheduleDto]] - `imports` [EXTRACTED]
- [[addDays()]] - `imports` [EXTRACTED]
- [[assign-cycle-count-line.dto.ts]] - `imports_from` [EXTRACTED]
- [[assign-cycle-count.dto.ts]] - `imports_from` [EXTRACTED]
- [[audit-log.service.ts]] - `imports_from` [EXTRACTED]
- [[company-access.service.ts]] - `imports_from` [EXTRACTED]
- [[company-read-scope.ts]] - `imports_from` [EXTRACTED]
- [[create-cycle-count.dto.ts]] - `imports_from` [EXTRACTED]
- [[current-user.types.ts]] - `imports_from` [EXTRACTED]
- [[cycle-count-execution.service.ts]] - `imports_from` [EXTRACTED]
- [[cycle-count-line-mutation.service.ts]] - `imports_from` [EXTRACTED]
- [[cycle-count-list.service.unit.spec.ts]] - `imports_from` [EXTRACTED]
- [[cycle-count-scheduler.service.ts]] - `imports_from` [EXTRACTED]
- [[cycle-count-snapshot.service.ts]] - `imports_from` [EXTRACTED]
- [[cycle-count-variance-detection.service.ts]] - `imports_from` [EXTRACTED]
- [[cycle-count-variance.service.ts]] - `imports_from` [EXTRACTED]
- [[cycle-count.constants.ts]] - `imports_from` [EXTRACTED]
- [[cycle-count.controller.ts]] - `imports_from` [EXTRACTED]
- [[cycle-count.module.ts]] - `imports_from` [EXTRACTED]
- [[cycleCountDetailPayload()]] - `imports` [EXTRACTED]
- [[cycleCountListItemPayload()]] - `imports` [EXTRACTED]
- [[domain-exceptions.ts]] - `imports_from` [EXTRACTED]
- [[isValidCycleCountInterval()]] - `imports` [EXTRACTED]
- [[list-cycle-counts-query.dto.ts]] - `imports_from` [EXTRACTED]
- [[list-product-history-query.dto.ts]] - `imports_from` [EXTRACTED]
- [[parseDiscrepancyOnly()]] - `imports` [EXTRACTED]
- [[parseOverdueOnly()]] - `imports` [EXTRACTED]
- [[prisma.service.ts]] - `imports_from` [EXTRACTED]
- [[readCompanyIdFilterRequired()]] - `imports` [EXTRACTED]
- [[realtime-ops.payload.ts]] - `imports_from` [EXTRACTED]
- [[realtime.service.ts]] - `imports_from` [EXTRACTED]
- [[skip-cycle-count-line.dto.ts]] - `imports_from` [EXTRACTED]
- [[submit-line-count.dto.ts]] - `imports_from` [EXTRACTED]
- [[tenant-rls.ts]] - `imports_from` [EXTRACTED]
- [[upsert-cycle-count-schedule.dto.ts]] - `imports_from` [EXTRACTED]
- [[withTenantRls()]] - `imports` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/cycle-countservicets