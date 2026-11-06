---
type: community
cohesion: 0.14
members: 16
---

# audit-logs.ts

**Cohesion:** 0.14 - loosely connected
**Members:** 16 nodes

## Members
- [[AuditListCache]] - code - frontend/src/realtime/activity-cache.ts
- [[AuditLogDetail]] - code - frontend/src/api/audit-logs.ts
- [[AuditLogListResult]] - code - frontend/src/api/audit-logs.ts
- [[AuditLogPolicy]] - code - frontend/src/api/audit-logs.ts
- [[AuditLogSummary]] - code - frontend/src/api/audit-logs.ts
- [[AuditLogsApi]] - code - frontend/src/api/audit-logs.ts
- [[ExportAuditLogsParams]] - code - frontend/src/api/audit-logs.ts
- [[ListAuditLogsParams]] - code - frontend/src/api/audit-logs.ts
- [[activity-cache.ts]] - code - frontend/src/realtime/activity-cache.ts
- [[audit-logs.ts]] - code - frontend/src/api/audit-logs.ts
- [[auditMatchesFilters()]] - code - frontend/src/realtime/activity-cache.ts
- [[compactParams()]] - code - frontend/src/api/audit-logs.ts
- [[patchAuditLogCreated()]] - code - frontend/src/realtime/activity-cache.ts
- [[patchNotificationCreated()]] - code - frontend/src/realtime/activity-cache.ts
- [[patchNotificationDeleted()]] - code - frontend/src/realtime/activity-cache.ts
- [[patchNotificationRead()]] - code - frontend/src/realtime/activity-cache.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/audit-logsts
SORT file.name ASC
```

## Connections to other communities
- 4 edges to [[_COMMUNITY_TextField]]
- 2 edges to [[_COMMUNITY_notificationsNotificationsPage.tsx]]
- 2 edges to [[_COMMUNITY_AuditLogDetailModal.tsx]]
- 2 edges to [[_COMMUNITY_OmsOrdersListPage.tsx]]
- 2 edges to [[_COMMUNITY_BackupHistoryPage.tsx]]
- 2 edges to [[_COMMUNITY_query-keys.ts]]
- 1 edge to [[_COMMUNITY_useWmsTranslation]]
- 1 edge to [[_COMMUNITY_Modal]]
- 1 edge to [[_COMMUNITY_client.ts]]
- 1 edge to [[_COMMUNITY_ref_tanstack_react_query]]

## Top bridge nodes
- [[audit-logs.ts]] - degree 16, connects to 7 communities
- [[activity-cache.ts]] - degree 13, connects to 3 communities
- [[AuditLogDetail]] - degree 3, connects to 2 communities
- [[AuditLogsApi]] - degree 3, connects to 2 communities
- [[AuditLogSummary]] - degree 3, connects to 1 community