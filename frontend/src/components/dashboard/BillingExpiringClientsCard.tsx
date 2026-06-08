import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { BillingApi } from '../../api/billing';
import { Button } from '../Button';
import { useToast } from '../ToastProvider';
import { QK } from '../../constants/query-keys';
import { useAuth } from '../../auth/AuthContext';
import { formatDate } from '../../lib/billing-invoice-display';

type Props = {
  translateLabel?: (label: string) => string;
};

const statCardClass =
  'rounded-xl border border-slate-100 bg-white p-3 shadow-sm sm:p-4';

export function BillingExpiringClientsCard({ translateLabel = (l) => l }: Props) {
  const { user } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const canMutate = user?.role === 'super_admin' || user?.role === 'wh_manager';

  const canSeeBilling =
    user?.role === 'super_admin' || user?.role === 'wh_manager' || user?.role === 'finance';

  const query = useQuery({
    queryKey: QK.billing.expiringSoon,
    queryFn: () => BillingApi.listExpiringSoon(5),
    enabled: canSeeBilling,
  });

  const renewMut = useMutation({
    mutationFn: (cycleId: string) => BillingApi.renewCycle(cycleId),
    onSuccess: () => {
      toast.success('Billing cycle marked for renewal.');
      void qc.invalidateQueries({ queryKey: QK.billing.expiringSoon });
      void qc.invalidateQueries({ queryKey: QK.billing.cycles });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (!canSeeBilling) return null;

  const rows = query.data ?? [];

  return (
    <div className={statCardClass}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-900">
          {translateLabel('Billing cycles expiring soon')}
        </h3>
        <Link
          to="/billing/plans"
          className="shrink-0 text-xs font-semibold text-brand-600 hover:text-brand-700 hover:underline underline-offset-2"
        >
          {translateLabel('View billing plans')}
        </Link>
      </div>

      {query.isPending ? (
        <p className="text-sm text-slate-500">{translateLabel('Loading…')}</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-500">
          {translateLabel('No active billing cycles expiring soon.')}
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <Link
                  to={`/billing/plans/${row.companyId}`}
                  className="font-medium text-brand-700 hover:underline"
                >
                  {row.company.name}
                </Link>
                <p className="mt-0.5 text-xs text-slate-500">
                  {translateLabel('Ends')} {formatDate(row.endsAt)} ·{' '}
                  <span
                    className={
                      row.daysRemaining <= 7 ? 'font-semibold text-amber-700' : 'text-slate-600'
                    }
                  >
                    {row.daysRemaining} {translateLabel('days remaining')}
                  </span>
                  {row.status === 'renewed' ? (
                    <span className="ms-2 badge badge-complete">{translateLabel('renewed')}</span>
                  ) : null}
                </p>
              </div>
              {canMutate && row.status === 'active' ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={renewMut.isPending}
                  onClick={() => {
                    if (!window.confirm('Mark this billing cycle for renewal when it expires?')) {
                      return;
                    }
                    renewMut.mutate(row.id);
                  }}
                >
                  {translateLabel('Renew')}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
