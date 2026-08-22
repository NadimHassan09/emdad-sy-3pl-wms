import { Link } from 'react-router-dom';

import type { OpenTasksByTypeRow } from '../../api/dashboard';
import { cn } from '@ds';

import { dashboardLabel } from './dashboard-i18n';
import { DashboardWidget, WidgetEmpty, WidgetLink } from './DashboardWidget';

const BAR_COLORS = [
  'bg-brand-500',
  'bg-amber-500',
  'bg-sky-500',
  'bg-violet-500',
  'bg-rose-500',
  'bg-teal-500',
];

export function WarehouseTasks({
  rows,
  isArabic,
  canOpenTasks,
}: {
  rows: OpenTasksByTypeRow[];
  isArabic: boolean;
  canOpenTasks: boolean;
}) {
  const t = (s: string) => dashboardLabel(s, isArabic);
  const pending = rows.reduce((s, r) => s + Math.max(0, r.openCount - r.inProgressCount), 0);

  const body = rows.length === 0 ? (
    <WidgetEmpty>{t('No open tasks')}</WidgetEmpty>
  ) : (
    <ul className="space-y-3">
      {rows.map((row, i) => {
        const pct = row.openCount > 0 ? (row.inProgressCount / row.openCount) * 100 : 0;
        const inner = (
          <>
            <div className="mb-1 flex items-center justify-between gap-2 text-xs">
              <span className="font-medium text-text-body">{t(row.label)}</span>
              <span className="tabular-nums text-text-muted">
                {row.inProgressCount} / {row.openCount}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-sunken">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  BAR_COLORS[i % BAR_COLORS.length],
                )}
                style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
              />
            </div>
          </>
        );
        return (
          <li key={row.key}>
            {canOpenTasks ? (
              <Link to={`/tasks?taskType=${encodeURIComponent(row.key)}`} className="block">
                {inner}
              </Link>
            ) : (
              inner
            )}
          </li>
        );
      })}
    </ul>
  );

  return (
    <DashboardWidget
      title={t('Warehouse Tasks')}
      action={canOpenTasks ? <WidgetLink to="/tasks">{t('View task board')}</WidgetLink> : null}
    >
      {body}
      {pending > 0 ? (
        <p className="mt-4 text-xs font-semibold text-status-danger-fg">
          {pending} {t('tasks pending')}
        </p>
      ) : null}
    </DashboardWidget>
  );
}
