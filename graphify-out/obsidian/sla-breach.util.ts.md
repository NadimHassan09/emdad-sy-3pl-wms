---
source_file: "backend/src/modules/warehouse-workflow/sla-breach.util.ts"
type: "code"
community: "NotificationsService"
location: "L1"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/NotificationsService
---

# sla-breach.util.ts

## Connections
- [[@prismaclient]] - `imports_from` [EXTRACTED]
- [[SLA_ESCALATION_COOLDOWN_MS]] - `contains` [EXTRACTED]
- [[TASK_TYPE_LABELS]] - `contains` [EXTRACTED]
- [[isTaskSlaBreached()]] - `contains` [EXTRACTED]
- [[operational-reports.runner.ts]] - `imports_from` [EXTRACTED]
- [[sla-breach.util.unit.spec.ts]] - `imports_from` [EXTRACTED]
- [[sla-escalation.service.ts]] - `imports_from` [EXTRACTED]
- [[sla-escalation.service.unit.spec.ts]] - `imports_from` [EXTRACTED]
- [[slaBreachDeadlineMs()]] - `contains` [EXTRACTED]
- [[slaOverdueMinutes()]] - `contains` [EXTRACTED]
- [[slaTaskTypeLabel()]] - `contains` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/NotificationsService