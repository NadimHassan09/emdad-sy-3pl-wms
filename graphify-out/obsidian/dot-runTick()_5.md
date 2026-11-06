---
source_file: "backend/src/modules/warehouse-workflow/sla-escalation.service.ts"
type: "code"
community: "NotificationsService"
location: "L47"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/NotificationsService
---

# .runTick()

## Connections
- [[dot-escalateTask()]] - `calls` [EXTRACTED]
- [[dot-escalated()]] - `calls` [INFERRED]
- [[dot-notifyManagersSlaBreach()]] - `calls` [INFERRED]
- [[dot-tick()_5]] - `calls` [EXTRACTED]
- [[SlaEscalationService]] - `method` [EXTRACTED]
- [[isTaskSlaBreached()]] - `calls` [EXTRACTED]
- [[slaOverdueMinutes()]] - `calls` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/NotificationsService