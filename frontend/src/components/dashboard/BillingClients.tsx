import { Link } from 'react-router-dom';

import type {
  BillingExpiringCycleRow,
  BillingOverdueClientRow,
  BillingRecentInvoiceRow,
} from '../../api/billing';
import { formatDate, humanizeInvoiceStatus } from '../../lib/billing-invoice-display';
import { cn } from '@ds';

import { dashboardLabel } from './dashboard-i18n';
import { DashboardWidget, WidgetEmpty, WidgetError, WidgetLink } from './DashboardWidget';

function invoiceTone(status: string): string {
  if (status === 'paid') return 'bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-400';
  if (status === 'cancelled') return 'bg-surface-sunken text-text-muted';
  return 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400';
}

export function BillingClients({
  expiring,
  overdue,
  invoices,
  canMutate,
  isArabic,
  onResolveOverdue,
  renewPending,
  isError,
  onRetry,
}: {
  expiring: BillingExpiringCycleRow[];
  overdue: BillingOverdueClientRow[];
  invoices: BillingRecentInvoiceRow[];
  canMutate: boolean;
  isArabic: boolean;
  onResolveOverdue?: (planId: string, companyName: string) => void;
  renewPending?: boolean;
  isError?: boolean;
  onRetry?: () => void;
}) {
  const t = (s: string) => dashboardLabel(s, isArabic);

  return (
    <DashboardWidget
      title={t('Billing & Clients')}
      action={<WidgetLink to="/billing/plans">{t('View all')}</WidgetLink>}
    >
      {isError ? (
        <WidgetError
          message={t('Unable to load this data.')}
          retryLabel={t('Try again')}
          onRetry={onRetry ?? (() => undefined)}
        />
      ) : (
      <div className="grid gap-5 sm:grid-cols-3">
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-text-faint">
            {t('Billing Cycles Ending Soon')}
          </p>
          {expiring.length === 0 ? (
            <WidgetEmpty>{t('No active billing cycles expiring soon.')}</WidgetEmpty>
          ) : (
            <ul className="space-y-2">
              {expiring.slice(0, 4).map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-2">
                  <Link
                    to={`/billing/plans/${row.companyId}`}
                    className="truncate text-xs font-medium text-text-strong hover:text-brand-700 dark:hover:text-brand-400"
                  >
                    {row.company.name}
                  </Link>
                  <span
                    className={cn(
                      'shrink-0 text-[11px] font-semibold tabular-nums',
                      row.daysRemaining <= 7 ? 'text-amber-600 dark:text-amber-400' : 'text-text-muted',
                    )}
                  >
                    {row.daysRemaining} {t('days')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-text-faint">
            {t('Overdue')}
          </p>
          {overdue.length === 0 ? (
            <WidgetEmpty>{t('No overdue clients.')}</WidgetEmpty>
          ) : (
            <ul className="space-y-3">
              {overdue.slice(0, 3).map((row) => (
                <li key={row.companyId} className="rounded-[10px] bg-rose-50 px-3 py-2 dark:bg-rose-950/30">
                  <Link
                    to={`/billing/plans/${row.companyId}`}
                    className="block truncate text-xs font-semibold text-text-strong hover:underline"
                  >
                    {row.companyName}
                  </Link>
                  <p className="mt-0.5 text-[11px] text-rose-700 dark:text-rose-400">
                    {t('Restricted access')}
                    {row.lastCycleEndedAt ? ` · ${formatDate(row.lastCycleEndedAt)}` : ''}
                  </p>
                  {canMutate && row.billingPlanId && onResolveOverdue ? (
                    <button
                      type="button"
                      disabled={renewPending}
                      onClick={() => onResolveOverdue(row.billingPlanId!, row.companyName)}
                      className="mt-1 text-[11px] font-semibold text-rose-700 hover:underline dark:text-rose-300"
                    >
                      {t('Resolve')}
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-text-faint">
            {t('Recent Invoices')}
          </p>
          {invoices.length === 0 ? (
            <WidgetEmpty>{t('No recent invoices.')}</WidgetEmpty>
          ) : (
            <ul className="space-y-2">
              {invoices.slice(0, 4).map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-2">
                  <Link
                    to={`/billing/invoices/${row.id}`}
                    className="truncate font-mono text-[11px] font-semibold text-text-strong hover:text-brand-700 dark:hover:text-brand-400"
                  >
                    <span dir="ltr">{row.invoiceNumber}</span>
                  </Link>
                  <span
                    className={cn(
                      'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold',
                      invoiceTone(row.status),
                    )}
                  >
                    {t(humanizeInvoiceStatus(row.status))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      )}
    </DashboardWidget>
  );
}
