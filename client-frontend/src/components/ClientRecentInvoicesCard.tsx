import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';

import { EmptyState } from '@ds';

import {
  formatDate,
  formatDecimal,
  humanizeInvoiceStatus,
  invoiceStatusClass,
} from '../lib/billing-display';
import type { ClientDashboardRecentInvoice } from '../services/clientDashboardService';

type Props = {
  rows: ClientDashboardRecentInvoice[];
  loading?: boolean;
  translateLabel?: (label: string) => string;
};

const cardClass =
  'rounded-xl border border-border-subtle bg-surface-card p-3 shadow-sm sm:p-4';

export function ClientRecentInvoicesCard({
  rows,
  loading,
  translateLabel = (l) => l,
}: Props): ReactElement {
  const t = translateLabel;

  return (
    <div className={cardClass}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-text-strong">{t('Recent invoices')}</h3>
        <Link
          to="/invoices"
          className="shrink-0 text-xs font-semibold text-brand-700 dark:text-brand-400 hover:text-brand-800 dark:hover:text-brand-300 hover:underline underline-offset-2"
        >
          {t('View all invoices')}
        </Link>
      </div>

      {loading ? (
        <p className="text-sm text-text-muted">{t('Loading…')}</p>
      ) : rows.length === 0 ? (
        <EmptyState
          size="sm"
          title={t('No recent invoices')}
          description={t('Invoices appear here after your billing cycle closes.')}
        />
      ) : (
        <ul className="divide-y divide-border-subtle">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <Link
                  to={`/invoices/${row.id}`}
                  className="font-mono text-xs font-semibold text-brand-700 dark:text-brand-400 hover:underline"
                >
                  <span dir="ltr">{row.invoiceNumber}</span>
                </Link>
                <p className="mt-0.5 truncate text-xs text-text-muted">
                  {formatDecimal(row.totalAmount)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className={invoiceStatusClass(row.status)}>
                  {humanizeInvoiceStatus(row.status)}
                </span>
                <span className="text-xs tabular-nums text-text-faint">
                  {formatDate(row.issuedAt ?? row.createdAt)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
