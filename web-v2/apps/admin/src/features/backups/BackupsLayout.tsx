import { useEffect, type ReactNode } from 'react'
import { useUiPreferences } from '@emdad/core'
import { PageHeader } from '@emdad/ui'
import { useAuth } from '@/auth/AuthContext'
import { useBackupMaintenanceWatch } from '@/hooks/useBackupMaintenance'
import { BackupOperationProvider, useBackupOperationContext } from './BackupOperationContext'
import { BackupsSubNav } from './BackupsSubNav'
import { SystemMaintenanceScreen } from './components/SystemMaintenanceScreen'

function BackupsLayoutBody({ children }: { children: ReactNode }) {
  const { isArabic } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const { user } = useAuth()
  const { trackedJobId, setTrackedJobId } = useBackupOperationContext()
  const watchMaintenance = user?.role === 'super_admin'

  const { activeOperation, jobStatus, maintenanceVisible } = useBackupMaintenanceWatch(
    watchMaintenance,
    trackedJobId,
  )

  useEffect(() => {
    if (jobStatus?.status === 'completed' || jobStatus?.status === 'failed') {
      setTrackedJobId(null)
    }
  }, [jobStatus?.status, setTrackedJobId])

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('Backups & recovery', 'النسخ الاحتياطي والاستعادة')}
        description={t(
          'Database backups, schedules, retention, and disaster recovery.',
          'نسخ قاعدة البيانات والجداول والاحتفاظ والتعافي من الكوارث.',
        )}
      />
      <BackupsSubNav />
      {children}
      {maintenanceVisible ? (
        <SystemMaintenanceScreen activeOperation={activeOperation} jobStatus={jobStatus} />
      ) : null}
    </div>
  )
}

export function BackupsLayout({ children }: { children: ReactNode }) {
  return (
    <BackupOperationProvider>
      <BackupsLayoutBody>{children}</BackupsLayoutBody>
    </BackupOperationProvider>
  )
}
