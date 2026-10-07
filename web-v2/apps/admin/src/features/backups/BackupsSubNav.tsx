import { Link, useLocation } from 'react-router'
import { useUiPreferences } from '@emdad/core'
import { cn } from '@emdad/ui'
import { Button } from '@emdad/ui/ui/button'
import { useAuth } from '@/auth/AuthContext'
import { useBackupAdminAccess } from '@/hooks/useBackupAdminAccess'
import { getVisibleBackupsTabs } from './backups-catalog'
import { useBackupOperationContext } from './BackupOperationContext'

export function BackupsSubNav() {
  const { pathname } = useLocation()
  const { isArabic } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const { user } = useAuth()
  const { canMutate } = useBackupAdminAccess()
  const {
    requestCreateBackup,
    createBackupBusy,
    requestCreateSchedule,
    requestUploadBackup,
    requestRestoreBackup,
    requestFactoryReset,
  } = useBackupOperationContext()

  const tabs = getVisibleBackupsTabs().filter(
    (entry) => !entry.superAdminOnly || user?.role === 'super_admin',
  )

  const onOverview = pathname === '/backups' || pathname === '/backups/'
  const onSchedules = pathname === '/backups/schedules' || pathname.startsWith('/backups/schedules/')

  return (
    <div className="flex flex-wrap items-center gap-3">
      <nav
        className="flex min-w-0 flex-1 flex-wrap gap-1 border-b pb-px"
        aria-label={t('Backups navigation', 'تنقل النسخ الاحتياطي')}
      >
        {tabs.map((entry) => {
          const active =
            pathname === entry.path ||
            (entry.path !== '/backups' && pathname.startsWith(`${entry.path}/`))
          return (
            <Link
              key={entry.id}
              to={entry.path}
              className={cn(
                'rounded-t-md px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'border-b-2 border-primary text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t(entry.titleEn, entry.titleAr)}
            </Link>
          )
        })}
      </nav>

      {canMutate && onOverview ? (
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={requestRestoreBackup} data-testid="restore-backup-btn">
            {t('Restore', 'استعادة')}
          </Button>
          <Button type="button" variant="destructive" onClick={requestFactoryReset} data-testid="factory-reset-btn">
            {t('Factory Reset', 'إعادة ضبط المصنع')}
          </Button>
          <Button type="button" variant="secondary" onClick={requestUploadBackup} data-testid="upload-backup-btn">
            {t('Upload', 'رفع')}
          </Button>
          <Button
            type="button"
            onClick={requestCreateBackup}
            disabled={createBackupBusy}
            data-testid="create-backup-btn"
          >
            {t('Create Backup', 'إنشاء نسخة احتياطية')}
          </Button>
        </div>
      ) : null}

      {canMutate && onSchedules ? (
        <Button type="button" onClick={requestCreateSchedule} data-testid="create-schedule-btn" className="shrink-0">
          {t('Create schedule', 'إنشاء جدولة')}
        </Button>
      ) : null}
    </div>
  )
}
