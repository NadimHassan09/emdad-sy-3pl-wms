---
type: community
cohesion: 0.29
members: 7
---

# backup-audit-actions.ts

**Cohesion:** 0.29 - loosely connected
**Members:** 7 nodes

## Members
- [[BACKUP_AUDIT_ACTION_PREFIXES]] - code - frontend/src/lib/backup-audit-actions.ts
- [[BACKUP_HEALTH_AUDIT_ACTIONS]] - code - frontend/src/lib/backup-audit-actions.ts
- [[DRIVE_RETENTION_AUDIT_ACTIONS]] - code - frontend/src/lib/backup-audit-actions.ts
- [[backup-audit-actions.ts]] - code - frontend/src/lib/backup-audit-actions.ts
- [[isBackupAuditAction()]] - code - frontend/src/lib/backup-audit-actions.ts
- [[isBackupHealthAuditAction()]] - code - frontend/src/lib/backup-audit-actions.ts
- [[isDriveRetentionAuditAction()]] - code - frontend/src/lib/backup-audit-actions.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/backup-audit-actionsts
SORT file.name ASC
```

## Connections to other communities
- 3 edges to [[_COMMUNITY_BackupHistoryPage.tsx]]

## Top bridge nodes
- [[backup-audit-actions.ts]] - degree 7, connects to 1 community
- [[isBackupAuditAction()]] - degree 3, connects to 1 community