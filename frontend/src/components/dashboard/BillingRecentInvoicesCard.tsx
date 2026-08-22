import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { BillingApi } from '../../api/billing';
import { StatusBadge } from '../StatusBadge';
import { QK } from '../../constants/query-keys';
import { useAuth } from '../../auth/AuthContext';
import { formatDate, formatDecimal } from '../../lib/billing-invoice-display';
import { Card, Skeleton } from '@ds';

type Props = {
  translateLabel?: (label: string) => string;
};

export function BillingRecentInvoicesCard({ translateLabel = (l) => l }: Props) {
  const { user } = useAuth();
  const canSeeBilling =
    user?.role === 'super_admin' || user?.role === 'wh_manager' || user?.role === 'finance';

  const query = useQuery({
    queryKey: QK.billing.recentInvoices,
    queryFn: () => BillingApi.listRecentInvoices(5),
    enabled: canSeeBilling,
  });

  if (!canSeeBilling) return null;

  const rows = query.data ?? [];

  return (
    <Card padding="md">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-text-strong">
          {translateLabel('Recent invoices')}
        </h3>
        <Link
          to="/billing/invoices"
          className="shrink-0 text-xs font-semibold text-brand-600 hover:text-brand-700 hover:underline underline-offset-2 dark:text-brand-400 dark:hover:text-brand-300"
        >
          {translateLabel('View all invoices')}
        </Link>
      </div>

      {query.isPending ? (
        <Skeleton height={80} />
      ) : rows.length === 0 ? (
        <p className="text-sm text-text-muted">
          {translateLabel('No recent invoices.')}
        </p>
      ) : (
        <ul className="divide-y divide-border-subtle">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <Link
                  to={`/billing/invoices/${row.id}`}
                  className="font-mono text-xs font-semibold text-brand-700 hover:underline dark:text-brand-400"
                >
                  <span dir="ltr">{row.invoiceNumber}</span>
                </Link>
                <p className="mt-0.5 truncate text-xs text-text-muted">
                  {row.companyName} · {formatDecimal(row.totalAmount)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <StatusBadge status={row.status} />
                <span className="text-xs tabular-nums text-text-faint">
                  {formatDate(row.createdAt)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
