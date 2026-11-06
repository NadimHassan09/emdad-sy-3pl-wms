---
type: community
cohesion: 0.16
members: 16
---

# settings-backup.ts

**Cohesion:** 0.16 - loosely connected
**Members:** 16 nodes

## Members
- [[BACKUP_STATUS_LABELS]] - code - frontend/src/lib/ui-labels/settings-backup.ts
- [[BACKUP_TYPE_LABELS]] - code - frontend/src/lib/ui-labels/settings-backup.ts
- [[BackupJobStatus]] - code - frontend/src/api/backups.ts
- [[BackupJobType]] - code - frontend/src/api/backups.ts
- [[STORAGE_POLICY_LABELS]] - code - frontend/src/lib/ui-labels/settings-backup.ts
- [[STORAGE_POLICY_LABELS_UI_HIDDEN]] - code - frontend/src/lib/ui-labels/settings-backup.ts
- [[T]] - code - frontend/src/lib/ui-labels/settings-backup.ts
- [[UseWmsTranslationResult]] - code - frontend/src/lib/ui-i18n.ts
- [[dataTablePaginationLabels()_1]] - code - frontend/src/lib/ui-labels/settings-backup.ts
- [[localizedBackupDetailFieldLabels()]] - code - frontend/src/lib/ui-labels/settings-backup.ts
- [[localizedBackupStoragePolicyLabel()]] - code - frontend/src/lib/ui-labels/settings-backup.ts
- [[localizedBackupStoragePolicyOptions()]] - code - frontend/src/lib/ui-labels/settings-backup.ts
- [[localizedScheduleFrequencyOptions()]] - code - frontend/src/lib/ui-labels/settings-backup.ts
- [[localizedScheduleStoragePolicyLabel()]] - code - frontend/src/lib/ui-labels/settings-backup.ts
- [[localizedScheduleStoragePolicyOptions()]] - code - frontend/src/lib/ui-labels/settings-backup.ts
- [[settings-backup.ts]] - code - frontend/src/lib/ui-labels/settings-backup.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/settings-backupts
SORT file.name ASC
```

## Connections to other communities
- 14 edges to [[_COMMUNITY_router.tsx]]
- 8 edges to [[_COMMUNITY_BackupHistoryPage.tsx]]
- 3 edges to [[_COMMUNITY_backups.ts]]
- 3 edges to [[_COMMUNITY_useWmsTranslation]]
- 2 edges to [[_COMMUNITY_backup-display.ts]]

## Top bridge nodes
- [[settings-backup.ts]] - degree 30, connects to 4 communities
- [[BackupJobStatus]] - degree 4, connects to 3 communities
- [[BackupJobType]] - degree 4, connects to 3 communities
- [[localizedBackupStoragePolicyLabel()]] - degree 8, connects to 2 communities
- [[localizedScheduleStoragePolicyLabel()]] - degree 5, connects to 1 community