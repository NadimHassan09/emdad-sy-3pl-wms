import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';

import { InboundApi } from '../api/inbound';
import { Alert, Skeleton } from '@ds';
import { AdminInboundOrderSummary } from '../components/orders/AdminInboundOrderSummary';
import { QK } from '../constants/query-keys';

/** Unified Order Execution: every origin opens the same Planning + Confirmation UI. */
export function InboundDetailPage() {
  const { id = '' } = useParams<{ id: string }>();

  const order = useQuery({
    queryKey: [...QK.inboundOrders, id],
    queryFn: () => InboundApi.get(id),
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
      <div className="animate-enter">
        <Alert variant="error" title="Failed to load inbound order." />
      </div>
    );
  }

  return <AdminInboundOrderSummary order={order.data} />;
}
