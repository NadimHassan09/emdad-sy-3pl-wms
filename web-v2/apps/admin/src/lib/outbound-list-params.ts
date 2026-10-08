import type { OutboundOrderStatus } from '@/api/outbound'

export type OutboundListFilterState = {
  orderSearch: string
  status: string
  createdFrom: string
  createdTo: string
  companyId: string
}

export const OUTBOUND_LIST_FILTER_DEFAULTS: OutboundListFilterState = {
  orderSearch: '',
  status: '',
  createdFrom: '',
  createdTo: '',
  companyId: '',
}

/** Canonical list/export query from applied outbound filters. */
export function buildOutboundListParams(
  applied: OutboundListFilterState,
  fallbackWarehouseId?: string,
) {
  return {
    warehouseId: fallbackWarehouseId || undefined,
    companyId: applied.companyId?.trim() || undefined,
    status: (applied.status?.trim() || undefined) as OutboundOrderStatus | undefined,
    orderSearch: applied.orderSearch?.trim() || undefined,
    createdFrom: applied.createdFrom?.trim() || undefined,
    createdTo: applied.createdTo?.trim() || undefined,
    quickDirectedOnly: false as const,
  }
}

/** Counts filters shown in the advanced section (+ status from the top bar, same badge pattern as before). */
export function countAppliedOutboundAdvancedFilters(applied: OutboundListFilterState): number {
  let n = 0
  if (applied.companyId?.trim()) n += 1
  if (applied.createdFrom?.trim()) n += 1
  if (applied.createdTo?.trim()) n += 1
  if (applied.status?.trim()) n += 1
  return n
}
