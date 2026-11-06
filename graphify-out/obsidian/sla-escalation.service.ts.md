---
source_file: "backend/src/modules/warehouse-workflow/sla-escalation.service.ts"
type: "code"
community: "NotificationsService"
location: "L1"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/NotificationsService
---

# sla-escalation.service.ts

## Connections
- [[@nestjscommon]] - `imports_from` [EXTRACTED]
- [[@nestjsschedule]] - `imports_from` [EXTRACTED]
- [[@prismaclient]] - `imports_from` [EXTRACTED]
- [[CronLeaderService]] - `imports` [EXTRACTED]
- [[EscalationOutcome]] - `contains` [EXTRACTED]
- [[NotificationsService]] - `imports` [EXTRACTED]
- [[PrismaService]] - `imports` [EXTRACTED]
- [[SLA_ESCALATION_COOLDOWN_MS]] - `imports` [EXTRACTED]
- [[SlaAuditService]] - `imports` [EXTRACTED]
- [[SlaEscalationService]] - `contains` [EXTRACTED]
- [[cron-leader.service.ts]] - `imports_from` [EXTRACTED]
- [[isTaskSlaBreached()]] - `imports` [EXTRACTED]
- [[notifications.service.ts]] - `imports_from` [EXTRACTED]
- [[prisma.service.ts]] - `imports_from` [EXTRACTED]
- [[sla-audit.service.ts]] - `imports_from` [EXTRACTED]
- [[sla-breach.util.ts]] - `imports_from` [EXTRACTED]
- [[sla-escalation.service.unit.spec.ts]] - `imports_from` [EXTRACTED]
- [[slaBreachDeadlineMs()]] - `imports` [EXTRACTED]
- [[slaOverdueMinutes()]] - `imports` [EXTRACTED]
- [[slaTaskTypeLabel()]] - `imports` [EXTRACTED]
- [[warehouse-workflow.module.ts]] - `imports_from` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/NotificationsService