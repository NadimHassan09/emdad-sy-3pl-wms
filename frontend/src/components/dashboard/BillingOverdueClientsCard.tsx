import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { BillingApi } from '../../api/billing';
import { QK } from '../../constants/query-keys';
import { useAuth } from '../../auth/AuthContext';
import { formatDate } from '../../lib/billing-invoice-display';

type Props = {
  translateLabel?: (label: string) => string;
};

const statCardClass =
  'rounded-xl border border-slate-100 bg-white p-3 shadow-sm sm:p-4';

export function BillingOverdueClientsCard({ translateLabel = (l) => l }: Props) {
  const { user } = useAuth();
  const canSeeBilling =
    user?.role === 'super_admin' || user?.role === 'wh_manager' || user?.role === 'finance';

  const query = useQuery({
    queryKey: QK.billing.overdueClients,
    queryFn: () => BillingApi.listOverdueClients(5),
    enabled: canSeeBilling,
  });

  if (!canSeeBilling) return null;

  const rows = query.data ?? [];

  return (
    <div className={statCardClass}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-900">
          {translateLabel('Overdue clients')}
        </h3>
        <Link
          to="/billing/plans?billingStatus=restricted"
          className="shrink-0 text-xs font-semibold text-brand-600 hover:text-brand-700 hover:underline underline-offset-2"
        >
          {translateLabel('View billing plans')}
        </Link>
      </div>

      {query.isPending ? (
        <p className="text-sm text-slate-500">{translateLabel('Loading…')}</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-500">
          {translateLabel('No overdue clients.')}
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {rows.map((row) => (
            <li key={row.companyId} className="py-3">
              <Link
                to={`/billing/plans/${row.companyId}`}
                className="font-medium text-brand-700 hover:underline"
              >
                {row.companyName}
              </Link>
              <p className="mt-0.5 text-xs text-rose-700">
                {translateLabel('Restricted')}
                {row.lastCycleEndedAt
                  ? ` · ${translateLabel('Cycle ended')} ${formatDate(row.lastCycleEndedAt)}`
                  : null}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
