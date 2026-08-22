import {
  Bell,
  Download,
  RefreshCw,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import { cn } from '@ds';

import { dashboardLabel } from './dashboard-i18n';
import { firstName, greetingForHour, lastUpdatedLabel } from './dashboard-utils';

export function DashboardHeader({
  fullName,
  isArabic,
  updatedAt,
  refreshing,
  onRefresh,
  onExport,
  notificationCount = 0,
}: {
  fullName?: string | null;
  isArabic: boolean;
  updatedAt: Date | null;
  refreshing?: boolean;
  onRefresh: () => void;
  onExport: () => void;
  notificationCount?: number;
}) {
  const t = (s: string) => dashboardLabel(s, isArabic);
  const hour = new Date().getHours();
  const greet = t(greetingForHour(hour));
  const name = firstName(fullName, t('Admin'));

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-text-strong sm:text-[1.75rem]">
          {greet}, {name} 👋
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          {t("Here's what's happening across your warehouse operations.")}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        {updatedAt ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-700 dark:text-brand-400">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-500" aria-hidden="true" />
            {t('Last updated')} {lastUpdatedLabel(updatedAt, isArabic)}
          </span>
        ) : null}

        <button
          type="button"
          onClick={onRefresh}
          className={cn(
            'inline-flex h-9 w-9 items-center justify-center rounded-[10px] border border-border bg-surface-panel text-text-body',
            'transition-colors hover:border-brand-200 hover:text-brand-700 dark:hover:border-brand-800 dark:hover:text-brand-400',
          )}
          aria-label={t('Refresh')}
        >
          <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} strokeWidth={1.75} />
        </button>

        <button
          type="button"
          onClick={onExport}
          className={cn(
            'inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-border bg-surface-panel px-3 text-xs font-semibold text-text-body',
            'transition-colors hover:border-brand-200 hover:text-brand-700 dark:hover:border-brand-800 dark:hover:text-brand-400',
          )}
        >
          <Download className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          {t('Export')}
        </button>

        <Link
          to="/notifications"
          className={cn(
            'relative inline-flex h-9 w-9 items-center justify-center rounded-[10px] border border-border bg-surface-panel text-text-body',
            'transition-colors hover:border-brand-200 hover:text-brand-700 dark:hover:border-brand-800 dark:hover:text-brand-400',
          )}
          aria-label={t('Notifications')}
        >
          <Bell className="h-4 w-4" strokeWidth={1.75} />
          {notificationCount > 0 ? (
            <span className="absolute -top-1 -end-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-status-danger-fg px-1 text-[10px] font-bold text-white">
              {notificationCount > 9 ? '9+' : notificationCount}
            </span>
          ) : null}
        </Link>
      </div>
    </div>
  );
}
