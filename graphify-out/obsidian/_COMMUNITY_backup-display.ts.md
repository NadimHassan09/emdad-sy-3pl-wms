---
type: community
cohesion: 0.11
members: 31
---

# backup-display.ts

**Cohesion:** 0.11 - loosely connected
**Members:** 31 nodes

## Members
- [[BackupActiveOperation]] - code - frontend/src/hooks/useBackupMaintenance.ts
- [[BackupManifest]] - code - frontend/src/api/backups.ts
- [[BackupStatus]] - code - frontend/src/api/backups.ts
- [[BackupStoragePolicyValue]] - code - frontend/src/api/backups.ts
- [[BackupSummary]] - code - frontend/src/api/backups.ts
- [[BackupsApi]] - code - frontend/src/api/backups.ts
- [[DOWNLOADABLE_BACKUP_TYPES]] - code - frontend/src/lib/backup-display.ts
- [[GdriveSyncStatus]] - code - frontend/src/lib/backup-display.ts
- [[Tone_1]] - code - shared/design-system-next/ui/types.ts
- [[asRecord()_1]] - code - frontend/src/lib/backup-display.ts
- [[backup-display.ts]] - code - frontend/src/lib/backup-display.ts
- [[backup-display.unit.spec.ts]] - code - frontend/src/lib/backup-display.unit.spec.ts
- [[backupCreatedByLabel()]] - code - frontend/src/lib/backup-display.ts
- [[backupStatusBadgeClass()]] - code - frontend/src/lib/backup-display.ts
- [[formatBackupStoragePolicy()]] - code - frontend/src/lib/backup-display.ts
- [[formatBackupType()]] - code - frontend/src/lib/backup-display.ts
- [[formatCooldownClock()]] - code - frontend/src/lib/backup-display.ts
- [[formatGdriveSyncStatus()]] - code - frontend/src/lib/backup-display.ts
- [[gdriveSyncBadgeClass()]] - code - frontend/src/lib/backup-display.ts
- [[isBackupDownloadable()]] - code - frontend/src/lib/backup-display.ts
- [[isBackupJobId()]] - code - frontend/src/lib/backup-display.ts
- [[isBackupRunning()]] - code - frontend/src/lib/backup-display.ts
- [[jobIdFromRecord()]] - code - frontend/src/lib/backup-display.ts
- [[manualBackupErrorMessage()]] - code - frontend/src/lib/backup-display.ts
- [[resolveCreatedBackupJobId()]] - code - frontend/src/lib/backup-display.ts
- [[shouldShowBackupProgress()]] - code - frontend/src/lib/backup-display.ts
- [[truncateBackupId()]] - code - frontend/src/lib/backup-display.ts
- [[useBackupMaintenance.ts]] - code - frontend/src/hooks/useBackupMaintenance.ts
- [[useBackupMaintenanceWatch()]] - code - frontend/src/hooks/useBackupMaintenance.ts
- [[useBackupRunningStatusPoll()]] - code - frontend/src/hooks/useBackupRunningStatusPoll.ts
- [[useBackupRunningStatusPoll.ts]] - code - frontend/src/hooks/useBackupRunningStatusPoll.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/backup-displayts
SORT file.name ASC
```

## Connections to other communities
- 28 edges to [[_COMMUNITY_BackupHistoryPage.tsx]]
- 15 edges to [[_COMMUNITY_router.tsx]]
- 10 edges to [[_COMMUNITY_backups.ts]]
- 4 edges to [[_COMMUNITY_design-system-nextuiindex.ts]]
- 4 edges to [[_COMMUNITY_query-keys.ts]]
- 3 edges to [[_COMMUNITY_design-system-nextuiFilterBar.tsx]]
- 2 edges to [[_COMMUNITY_settings-backup.ts]]
- 2 edges to [[_COMMUNITY_ref_tanstack_react_query]]
- 1 edge to [[_COMMUNITY_TextField]]
- 1 edge to [[_COMMUNITY_OmsOrdersListPage.tsx]]

## Top bridge nodes
- [[backup-display.ts]] - degree 39, connects to 5 communities
- [[useBackupRunningStatusPoll.ts]] - degree 13, connects to 5 communities
- [[useBackupMaintenance.ts]] - degree 12, connects to 5 communities
- [[Tone_1]] - degree 7, connects to 4 communities
- [[BackupsApi]] - degree 9, connects to 3 communities