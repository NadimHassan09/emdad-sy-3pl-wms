import { useQuery } from '@tanstack/react-query';

import { AuditLogsApi } from '../../api/audit-logs';
import { QK } from '../../constants/query-keys';
import { formatAuditActionLabel, formatAuditTimestamp } from '../../lib/audit-log-display';
import { isDriveRetentionAuditAction } from '../../lib/backup-audit-actions';
import { useWmsTranslation } from '../../lib/ui-i18n';
import { PANEL_CARD_CLASS, PANEL_TITLE_CLASS } from '../FilterPanel';

type Props = {
  limit?: number;
};

export function BackupDriveRetentionAuditPanel({ limit = 10 }: Props) {
  const { t } = useWmsTranslation();

  const query = useQuery({
    queryKey: QK.backups.driveRetentionAudit,
    queryFn: async () => {
      const result = await AuditLogsApi.list({
        limit: 50,
        offset: 0,
        sort_by: 'created_at',
        sort_dir: 'desc',
      });
      return result.items.filter((row) => isDriveRetentionAuditAction(row.action)).slice(0, limit);
    },
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  return (
    <section className={PANEL_CARD_CLASS}>
      <h2 className={PANEL_TITLE_CLASS}>
        {t(['Drive retention audit events', 'أحداث تدقيق احتفاظ Drive'])}
      </h2>
      {query.isLoading ? (
        <p className="text-sm text-slate-500">{t(['Loading…', 'جارٍ التحميل…'])}</p>
      ) : query.data && query.data.length > 0 ? (
        <ul className="divide-y divide-slate-100">
          {query.data.map((row) => (
            <li
              key={row.id}
              className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800">
                  {formatAuditActionLabel(row.action)}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {row.actorEmail} · {row.resourceType}
                </p>
              </div>
              <time className="shrink-0 text-xs text-slate-500" dateTime={row.createdAt}>
                {formatAuditTimestamp(row.createdAt)}
              </time>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-500">
          {t(['No Drive retention audit events yet.', 'لا توجد أحداث تدقيق احتفاظ Drive بعد.'])}
        </p>
      )}
    </section>
  );
}
