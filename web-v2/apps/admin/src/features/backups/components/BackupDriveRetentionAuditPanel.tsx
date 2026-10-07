import { useQuery } from '@tanstack/react-query'
import { useUiPreferences } from '@emdad/core'
import { Widget } from '@emdad/ui'
import { AuditLogsApi } from '@/api/audit-logs'
import { QK } from '@/constants/query-keys'
import { formatAuditActionLabel, formatAuditTimestamp } from '@/lib/audit-log-display'
import { isDriveRetentionAuditAction } from '@/lib/backup-audit-actions'

export function BackupDriveRetentionAuditPanel({ limit = 10 }: { limit?: number }) {
  const { isArabic } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)

  const query = useQuery({
    queryKey: QK.backups.driveRetentionAudit,
    queryFn: async () => {
      const result = await AuditLogsApi.list({
        limit: 50,
        offset: 0,
        sort_by: 'created_at',
        sort_dir: 'desc',
      })
      return result.items.filter((row) => isDriveRetentionAuditAction(row.action)).slice(0, limit)
    },
    staleTime: 30_000,
    refetchInterval: 30_000,
  })

  return (
    <Widget title={t('Drive retention audit events', 'أحداث تدقيق احتفاظ Drive')}>
      {query.isLoading ? (
        <p className="text-sm text-muted-foreground">{t('Loading…', 'جارٍ التحميل…')}</p>
      ) : query.data && query.data.length > 0 ? (
        <ul className="divide-y">
          {query.data.map((row) => (
            <li key={row.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium">{formatAuditActionLabel(row.action)}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {row.actorEmail} · {row.resourceType}
                </p>
              </div>
              <time className="shrink-0 text-xs text-muted-foreground" dateTime={row.createdAt}>
                {formatAuditTimestamp(row.createdAt)}
              </time>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          {t('No Drive retention audit events yet.', 'لا توجد أحداث تدقيق احتفاظ Drive بعد.')}
        </p>
      )}
    </Widget>
  )
}
