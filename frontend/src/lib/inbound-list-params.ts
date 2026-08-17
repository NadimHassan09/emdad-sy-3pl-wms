import type { InboundOrderStatus } from '../api/inbound';

export type InboundListFilterState = {
  orderSearch: string;
  status: string;
  createdFrom: string;
  createdTo: string;
};

/** Canonical list/export query from applied inbound filters. */
export function buildInboundListParams(
  applied: InboundListFilterState,
  warehouseId?: string,
) {
  return {
    warehouseId: warehouseId || undefined,
    status: (applied.status.trim() || undefined) as InboundOrderStatus | undefined,
    orderSearch: applied.orderSearch.trim() || undefined,
    createdFrom: applied.createdFrom.trim() || undefined,
    createdTo: applied.createdTo.trim() || undefined,
  };
}
