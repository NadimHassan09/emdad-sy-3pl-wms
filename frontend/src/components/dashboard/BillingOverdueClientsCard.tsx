import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { BillingApi } from '../../api/billing';
import { Button } from '../Button';
import { useToast } from '../ToastProvider';
import { QK } from '../../constants/query-keys';
import { useAuth } from '../../auth/AuthContext';
import { formatDate } from '../../lib/billing-invoice-display';
import { Card, Skeleton } from '@ds';

type Props = {
  translateLabel?: (label: string) => string;
};

export function BillingOverdueClientsCard({ translateLabel = (l) => l }: Props) {
  const { user } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const canSeeBilling =
    user?.role === 'super_admin' || user?.role === 'wh_manager' || user?.role === 'finance';
  const canMutate = user?.role === 'super_admin' || user?.role === 'wh_manager';

  const query = useQuery({
    queryKey: QK.billing.overdueClients,
    queryFn: () => BillingApi.listOverdueClients(5),
    enabled: canSeeBilling,
  });

  const renewMut = useMutation({
    mutationFn: (planId: string) => BillingApi.renewPlan(planId),
    onSuccess: () => {
      toast.success('Billing plan renewed. Access restored and a new cycle started.');
      void qc.invalidateQueries({ queryKey: QK.billing.overdueClients });
      void qc.invalidateQueries({ queryKey: QK.billing.suspendedAccounts });
      void qc.invalidateQueries({ queryKey: QK.billing.plans });
      void qc.invalidateQueries({ queryKey: QK.billing.cycles });
      void qc.invalidateQueries({ queryKey: QK.companies });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (!canSeeBilling) return null;

  const rows = query.data ?? [];

  return (
    <Card padding="md">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-text-strong">
          {translateLabel('Overdue clients')}
        </h3>
        <Link
          to="/billing/plans?billingStatus=restricted"
          className="shrink-0 text-xs font-semibold text-brand-600 hover:text-brand-700 hover:underline underline-offset-2 dark:text-brand-400 dark:hover:text-brand-300"
        >
          {translateLabel('View billing plans')}
        </Link>
      </div>

      {query.isPending ? (
        <Skeleton height={80} />
      ) : rows.length === 0 ? (
        <p className="text-sm text-text-muted">
          {translateLabel('No overdue clients.')}
        </p>
      ) : (
        <ul className="divide-y divide-border-subtle">
          {rows.map((row) => (
            <li
              key={row.companyId}
              className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <Link
                  to={`/billing/plans/${row.companyId}`}
                  className="font-medium text-brand-700 hover:underline dark:text-brand-400"
                >
                  {row.companyName}
                </Link>
                <p className="mt-0.5 text-xs text-status-danger-fg">
                  {translateLabel('Restricted')}
                  {row.lastCycleEndedAt
                    ? ` · ${translateLabel('Cycle ended')} ${formatDate(row.lastCycleEndedAt)}`
                    : null}
                </p>
              </div>
              {canMutate && row.billingPlanId ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={renewMut.isPending}
                  onClick={() => {
                    if (
                      !window.confirm(
                        `Renew billing plan for ${row.companyName}? This restores access and starts a new billing cycle.`,
                      )
                    ) {
                      return;
                    }
                    renewMut.mutate(row.billingPlanId!);
                  }}
                >
                  {translateLabel('Renew')}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
