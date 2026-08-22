import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';

import { OutboundApi } from '../api/outbound';
import { Alert, Skeleton } from '@ds';
import { AdminOutboundOrderSummary } from '../components/orders/AdminOutboundOrderSummary';
import { QK } from '../constants/query-keys';

/** Unified Order Execution: every origin opens the same Planning + Confirmation UI. */
export function OutboundDetailPage() {
  const { id = '' } = useParams<{ id: string }>();

  const order = useQuery({
    queryKey: [...QK.outboundOrders, id],
    queryFn: () => OutboundApi.get(id),
    enabled: !!id,
  });

  if (!id) return null;
  if (order.isLoading) {
    return (
      <div className="space-y-4 animate-enter">
        <Skeleton height={20} width="30%" />
        <Skeleton height={180} />
        <Skeleton height={220} />
      </div>
    );
  }
  if (order.isError || !order.data) {
    return (
      <div className="animate-enter space-y-3">
        <Link
          to="/orders/outbound"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-text-muted hover:text-text-strong"
        >
          ← All outbound orders
        </Link>
        <Alert variant="error" title="Failed to load outbound order." />
      </div>
    );
  }

  return <AdminOutboundOrderSummary order={order.data} />;
}
