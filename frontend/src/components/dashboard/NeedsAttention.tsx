import { AlertTriangle, CircleAlert } from 'lucide-react';
import { Link } from 'react-router-dom';

import { cn } from '@ds';

import { dashboardLabel } from './dashboard-i18n';
import { DashboardWidget, WidgetEmpty, WidgetLink } from './DashboardWidget';

export type AttentionSeverity = 'critical' | 'warning';

export type AttentionItem = {
  id: string;
  severity: AttentionSeverity;
  title: string;
  description: string;
  actionLabel: string;
  to?: string;
  onAction?: () => void;
  actionDisabled?: boolean;
};

export function NeedsAttention({
  items,
  isArabic,
}: {
  items: AttentionItem[];
  isArabic: boolean;
}) {
  const t = (s: string) => dashboardLabel(s, isArabic);
  const count = items.length;

  return (
    <DashboardWidget
      title={t('Needs Attention')}
      badge={
        count > 0 ? (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-status-danger-fg px-1.5 text-[11px] font-bold text-white">
            {count}
          </span>
        ) : null
      }
      action={<WidgetLink to="/notifications">{t('View all alerts')}</WidgetLink>}
    >
      {items.length === 0 ? (
        <WidgetEmpty>{t('No items need attention.')}</WidgetEmpty>
      ) : (
        <ul className="divide-y divide-border-subtle">
          {items.slice(0, 4).map((item) => {
            const Icon = item.severity === 'critical' ? CircleAlert : AlertTriangle;
            const critical = item.severity === 'critical';
            return (
              <li key={item.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                <span
                  className={cn(
                    'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                    critical
                      ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400'
                      : 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400',
                  )}
                >
                  <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-text-strong">{item.title}</p>
                  <p className="mt-0.5 truncate text-xs text-text-muted">{item.description}</p>
                </div>
                {item.onAction ? (
                  <button
                    type="button"
                    disabled={item.actionDisabled}
                    onClick={item.onAction}
                    className="shrink-0 text-xs font-semibold text-brand-600 hover:underline disabled:opacity-50 dark:text-brand-400"
                  >
                    {item.actionLabel}
                  </button>
                ) : item.to ? (
                  <Link
                    to={item.to}
                    className="shrink-0 text-xs font-semibold text-brand-600 hover:underline dark:text-brand-400"
                  >
                    {item.actionLabel}
                  </Link>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </DashboardWidget>
  );
}
