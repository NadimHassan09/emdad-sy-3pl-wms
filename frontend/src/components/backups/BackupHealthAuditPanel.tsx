import { useQueries, useQuery } from '@tanstack/react-query';

import { AuditLogsApi } from '../../api/audit-logs';
import { QK } from '../../constants/query-keys';
import { formatAuditTimestamp } from '../../lib/audit-log-display';
import { isBackupHealthAuditAction } from '../../lib/backup-audit-actions';
import { useWmsTranslation } from '../../lib/ui-i18n';
import { PANEL_CARD_CLASS, PANEL_TITLE_CLASS } from '../FilterPanel';

type HealthAuditState = {
  code?: string;
  severity?: string;
  message?: string;
};

type Props = {
  limit?: number;
};

function severityBadgeClass(severity: string | undefined): string {
  if (severity === 'critical') return 'bg-rose-50 text-rose-800 ring-rose-600/20';
  if (severity === 'warning') return 'bg-amber-50 text-amber-800 ring-amber-600/20';
  return 'bg-slate-50 text-slate-700 ring-slate-600/20';
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
    <section className={PANEL_CARD_CLASS}>
      <h2 className={PANEL_TITLE_CLASS}>
        {t(['Recent health monitoring events', 'أحداث مراقبة الصحة الأخيرة'])}
      </h2>
      {listQuery.isLoading ? (
        <p className="text-sm text-slate-500">{t(['Loading…', 'جارٍ التحميل…'])}</p>
      ) : rows.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-start text-xs uppercase tracking-wide text-slate-500">
                <th className="px-2 py-2 font-medium">{t(['Timestamp', 'الوقت'])}</th>
                <th className="px-2 py-2 font-medium">{t(['Code', 'الرمز'])}</th>
                <th className="px-2 py-2 font-medium">{t(['Severity', 'الخطورة'])}</th>
                <th className="px-2 py-2 font-medium">{t(['Message', 'الرسالة'])}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="whitespace-nowrap px-2 py-3 text-slate-600">
                    <time dateTime={row.createdAt}>{formatAuditTimestamp(row.createdAt)}</time>
                  </td>
                  <td className="px-2 py-3 font-mono text-xs text-slate-700">{row.code}</td>
                  <td className="px-2 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${severityBadgeClass(row.severity)}`}
                    >
                      {row.severity}
                    </span>
                  </td>
                  <td className="max-w-md px-2 py-3 text-slate-700">{row.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-slate-500">
          {t(['No health monitoring events yet.', 'لا توجد أحداث مراقبة صحة بعد.'])}
        </p>
      )}
    </section>
  );
}
