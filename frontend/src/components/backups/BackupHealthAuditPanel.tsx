import { useQueries, useQuery } from '@tanstack/react-query';
import { Badge, SectionContainer } from '@ds';
import type { Tone } from '@ds';
import { QK } from '../../constants/query-keys';
import { formatAuditTimestamp } from '../../lib/audit-log-display';
import { isBackupHealthAuditAction } from '../../lib/backup-audit-actions';
import { useWmsTranslation } from '../../lib/ui-i18n';

import { AuditLogsApi } from '../../api/audit-logs';

type HealthAuditState = {
  code?: string;
  severity?: string;
  message?: string;
};

type Props = {
  limit?: number;
};

function severityTone(severity: string | undefined): Tone {
  if (severity === 'critical') return 'danger';
  if (severity === 'warning') return 'warning';
  return 'neutral';
}

export function BackupHealthAuditPanel({ limit = 10 }: Props) {
  const { t } = useWmsTranslation();

  const listQuery = useQuery({
    queryKey: QK.backups.healthAudit,
    queryFn: async () => {
      const result = await AuditLogsApi.list({
        limit: 80,
        offset: 0,
        sort_by: 'created_at',
        sort_dir: 'desc',
      });
      return result.items.filter((row) => isBackupHealthAuditAction(row.action)).slice(0, limit);
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const detailQueries = useQueries({
    queries: (listQuery.data ?? []).map((row) => ({
      queryKey: QK.auditLogs.detail(row.id),
      queryFn: () => AuditLogsApi.getById(row.id),
      staleTime: 60_000,
      enabled: !!listQuery.data,
    })),
  });

  const rows = (listQuery.data ?? []).map((summary, index) => {
    const detail = detailQueries[index]?.data;
    const state = (detail?.newState ?? {}) as HealthAuditState;
    const severity =
      state.severity ?? (summary.action === 'backup.health.critical' ? 'critical' : 'warning');
    return {
      id: summary.id,
      createdAt: summary.createdAt,
      action: summary.action,
      code: state.code ?? '—',
      severity,
      message: state.message ?? summary.action,
    };
  });

  return (
    <SectionContainer title={t(['Recent health monitoring events', 'أحداث مراقبة الصحة الأخيرة'])}>
      {listQuery.isLoading ? (
        <p className="text-sm text-text-muted">{t(['Loading…', 'جارٍ التحميل…'])}</p>
      ) : rows.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border text-start text-xs uppercase tracking-wide text-text-muted">
                <th className="px-2 py-2 font-medium">{t(['Timestamp', 'الوقت'])}</th>
                <th className="px-2 py-2 font-medium">{t(['Code', 'الرمز'])}</th>
                <th className="px-2 py-2 font-medium">{t(['Severity', 'الخطورة'])}</th>
                <th className="px-2 py-2 font-medium">{t(['Message', 'الرسالة'])}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="whitespace-nowrap px-2 py-3 text-text-body">
                    <time dateTime={row.createdAt}>{formatAuditTimestamp(row.createdAt)}</time>
                  </td>
                  <td className="px-2 py-3 font-mono text-xs text-text-body">{row.code}</td>
                  <td className="px-2 py-3">
                    <Badge tone={severityTone(row.severity)} size="xs">
                      {row.severity}
                    </Badge>
                  </td>
                  <td className="max-w-md px-2 py-3 text-text-body">{row.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-text-muted">
          {t(['No health monitoring events yet.', 'لا توجد أحداث مراقبة صحة بعد.'])}
        </p>
      )}
    </SectionContainer>
  );
}
