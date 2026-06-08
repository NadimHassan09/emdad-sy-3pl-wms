# UI-FIX-1 — Admin Dashboard UI Consistency Pass Report

**Generated:** 2026-06-08  
**Environment:** Staging codebase (`emdad-sy-3pl-wms`)  
**Reference standard:** Inbound Orders (`/orders/inbound`) — horizontal filter grid + pill sub-navigation  
**Deliverable:** This file only

---

## Executive Summary

UI-FIX-1 aligns broken admin pages with the Inbound Orders design standard and fixes Backup History data/logic issues. Navigation cards/tabs were replaced with shared **pill sub-nav** styling; stacked filters were converted to responsive horizontal grids; backup list queries now exclude restore operations and report accurate counts/progress.

| Area | Status |
|------|--------|
| Returns — horizontal filters | **Done** |
| Cycle Count — pill view nav | **Done** |
| Settings / Backup — pill tab nav | **Done** |
| Reporting Center — pill tab nav | **Done** |
| Backup History — data source audit + fixes | **Done** |

---

## Reference Standard (Inbound Orders)

**File:** `frontend/src/pages/InboundListPage.tsx`

- `FilterPanel` with responsive grid: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5`
- Page title + primary action on `DataTable` (not separate `PageHeader`)
- Section sub-nav pills via `SectionSubNavCard` / `section-sub-nav.ts`

---

## 1. Returns Page

**File:** `frontend/src/pages/returns/ReturnsListPage.tsx`

### Before

![Returns stacked filters — before](../assets/c__Users_Mega_Store_AppData_Roaming_Cursor_User_workspaceStorage_1ccdd240bc09de9e041928d7306c3784_images_sfdfdsfds-dab01e04-6c43-4674-ba8b-47053873605b.png)

Filters stacked vertically; title/actions on separate `PageHeader`.

### After

- Removed `PageHeader`; title, description, and **+ New return** moved to `DataTable`
- Filters in horizontal grid (`xl:grid-cols-4`): Search, Status, Created from, Created to
- `FilterPanel` loading state + localized apply/reset labels
- Errors via `@ds` `Alert`

---

## 2. Cycle Count

**File:** `frontend/src/pages/cycle-count/CycleCountListPage.tsx`

### Before

![Cycle Count underline tabs — before](../assets/c__Users_Mega_Store_AppData_Roaming_Cursor_User_workspaceStorage_1ccdd240bc09de9e041928d7306c3784_images_asddassa-5b6bee55-e637-4d99-8c71-302d2a50d518.png)

Underline text tabs for Count sessions / Product schedule; duplicate header actions.

### After

- Underline tabs replaced with **`PillSubNav`** (emerald active pill — matches Orders/Inventory)
- Removed redundant `PageHeader` / My-tasks button (global `SectionSubNavCard` still provides Dashboard ↔ My tasks)
- Filter grid aligned to Inbound breakpoints (`xl:grid-cols-5`)
- Table titles on `DataTable` per active view

---

## 3. Settings / Backup

**Files:** `frontend/src/components/settings/SettingsNav.tsx`, `frontend/src/pages/settings/SettingsLayout.tsx`

### Before

![Settings card tabs — before](../assets/c__Users_Mega_Store_AppData_Roaming_Cursor_User_workspaceStorage_1ccdd240bc09de9e041928d7306c3784_images_dfsfdfsd-ff558385-adfe-4390-9858-43d46e899e97.png)

Large card tabs with title + description per tab.

### After

- **`SettingsNav`** uses shared `PillSubNav` — compact emerald pills (History, Upload, Restore, …)
- Removed double card wrapper in `SettingsLayout` (nav component includes panel shell)

---

## 4. Reporting Center

**Files:** `frontend/src/components/reports/ReportsNav.tsx`, `frontend/src/pages/reports/ReportsLayout.tsx`

### Before

![Reporting Center card nav — before](../assets/c__Users_Mega_Store_AppData_Roaming_Cursor_User_workspaceStorage_1ccdd240bc09de9e041928d7306c3784_images_fsdfdssdf-d92aabed-2d6b-45f4-b6e3-f8cfacde20ab.png)

Large descriptive navigation cards.

### After

- **`ReportsNav`** uses `PillSubNav`: Warehouse Analysis | Inventory | Product Moves
- Matches Orders/Inventory pill styling

---

## 5. Backup History — Full Audit & Fixes

**Files:**  
`backend/src/modules/backups/backups.service.ts`  
`backend/src/modules/backups/dto/list-backups-query.dto.ts`  
`backend/src/modules/backups/backup-runner.service.ts`  
`frontend/src/pages/settings/BackupHistoryPage.tsx`  
`frontend/src/lib/backup-display.ts`

### Before

![Backup History restore rows + stuck 5% — before](../assets/c__Users_Mega_Store_AppData_Roaming_Cursor_User_workspaceStorage_1ccdd240bc09de9e041928d7306c3784_images_dfsfdssd-61a14edb-8918-414f-8a8e-2ca9e6ba87ad.png)

Issues observed:
1. **Restore** operations listed as backup records
2. **Scheduled** backups missing from list (despite existing in DB)
3. Running jobs stuck at **5%** (placeholder progress before bytes written)
4. Misleading count included restore rows
5. Stacked filter layout

### Audit findings

| Job type | Was in list? | Should be in Backup History? | Downloadable? |
|----------|--------------|------------------------------|---------------|
| `manual` | Yes | Yes | Yes (when completed + bytes) |
| `scheduled` | **No** | Yes | Yes |
| `upload` | Yes | Yes | Yes |
| `pre_snapshot` | Yes | Yes | Yes |
| `restore` | Yes | **No** | No |
| `factory_reset` | No | No | No |

Progress: `backup-runner.service.ts` initialized `progressPercent: 5` before `pg_dump` wrote bytes — UI showed permanent 5% for restore rows and stalled backups.

### Fixes applied

1. **List filter** — `BACKUP_HISTORY_JOB_TYPES`: `manual`, `scheduled`, `upload`, `pre_snapshot` only (excludes `restore`, `factory_reset`)
2. **Server-side filters** — `ListBackupsQueryDto` accepts `type`, `status`, `search`; removed client `listAll()` filtering path
3. **Correct count** — `total` from DB matches filtered backup types only
4. **Progress display** — runner starts at `0%`; progress scales from bytes written; UI shows percent only via `shouldShowBackupProgress()` when bytes > 0 or progress advanced
5. **Download gating** — unchanged `isBackupDownloadable()` (completed + bytes + downloadable type); restore rows no longer appear
6. **Filter layout** — horizontal grid matching Inbound Orders
7. **Type filter options** — added Scheduled; removed Restore

### After (expected)

- Backup History shows only true backup artifacts
- Count label: `N backup(s) — manual, scheduled, upload, and pre-snapshot only`
- Running jobs show progress only after bytes are written
- No Download button on non-artifact rows

---

## 6. Shared Component

**New:** `frontend/src/components/PillSubNav.tsx`

Reusable pill navigation matching `SectionSubNavCard` styling. Used by Settings, Reports, and Cycle Count view switcher.

---

## 7. Files Changed

| Area | Paths |
|------|-------|
| Shared nav | `frontend/src/components/PillSubNav.tsx` |
| Returns | `frontend/src/pages/returns/ReturnsListPage.tsx` |
| Cycle Count | `frontend/src/pages/cycle-count/CycleCountListPage.tsx` |
| Settings | `frontend/src/components/settings/SettingsNav.tsx`, `SettingsLayout.tsx` |
| Reports | `frontend/src/components/reports/ReportsNav.tsx`, `ReportsLayout.tsx` |
| Backup History UI | `frontend/src/pages/settings/BackupHistoryPage.tsx`, `backup-display.ts`, `settings-backup.ts`, `api/backups.ts` |
| Backup History API | `backups.service.ts`, `list-backups-query.dto.ts`, `backup-runner.service.ts` |
| Report | `UI-FIX-1-REPORT.md` |

---

## 8. Verification

```bash
cd backend && npm run build   # pass
cd frontend && npm run build  # pass
```

Manual smoke test:
- [ ] `/returns` — filters in one horizontal row; table title + New return button
- [ ] `/cycle-count` — emerald pill tabs for sessions/schedule
- [ ] `/settings/backups` — pill tabs; no restore rows; scheduled backups visible
- [ ] `/reports/warehouse-analysis` — pill tabs (not cards)
- [ ] Start manual backup — progress hidden until bytes written, then updates via poll

---

## 9. Git

Pushed to `staging` branch on `https://github.com/NadimHassan09/emdad-sy-3pl-wms.git`.
