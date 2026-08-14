import type { LucideIcon } from 'lucide-react';
import {
  FileText,
  PackageCheck,
  PackageOpen,
  Truck,
  UserMinus,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import { dashboardLabel } from './dashboard-i18n';
import { relativeTime } from './dashboard-utils';
import { DashboardWidget, WidgetEmpty, WidgetLink } from './DashboardWidget';

export type ActivityItem = {
  id: string;
  title: string;
  subtitle?: string;
  at: string;
  to?: string;
  tone: 'green' | 'blue' | 'amber' | 'rose' | 'purple';
  icon: 'outbound' | 'inbound' | 'invoice' | 'task' | 'client';
};

const ICONS: Record<ActivityItem['icon'], LucideIcon> = {
  outbound: Truck,
  inbound: PackageOpen,
  invoice: FileText,
  task: PackageCheck,
  client: UserMinus,
};

const TONE: Record<ActivityItem['tone'], string> = {
  green: 'bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-400',
  blue: 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400',
  amber: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
  rose: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400',
  purple: 'bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400',
};

export function RecentActivity({
  items,
  isArabic,
}: {
  items: ActivityItem[];
  isArabic: boolean;
}) {
  const t = (s: string) => dashboardLabel(s, isArabic);

  return (
    <DashboardWidget
      title={t('Recent Activity')}
      action={<WidgetLink to="/orders/outbound">{t('View all')}</WidgetLink>}
    >
      {items.length === 0 ? (
        <WidgetEmpty>{t('No recent activity.')}</WidgetEmpty>
      ) : (
        <ul className="space-y-1">
          {items.slice(0, 6).map((item) => {
            const Icon = ICONS[item.icon];
            const content = (
              <div className="flex items-start gap-3 rounded-[10px] px-1 py-2 transition-colors hover:bg-surface-hover">
                <span
                  className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${TONE[item.tone]}`}
                >
                  <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-text-strong">{item.title}</p>
                  {item.subtitle ? (
                    <p className="mt-0.5 truncate text-xs text-text-muted">{item.subtitle}</p>
                  ) : null}
                </div>
                <span className="shrink-0 text-[11px] tabular-nums text-text-faint">
                  {relativeTime(item.at, isArabic)}
                </span>
              </div>
            );
            return (
              <li key={item.id}>
                {item.to ? <Link to={item.to}>{content}</Link> : content}
              </li>
            );
          })}
        </ul>
      )}
    </DashboardWidget>
  );
}
