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
export function buildOutboundListParams(applied: OutboundListFilterState, warehouseId?: string) {
  return {
    warehouseId: warehouseId || undefined,
    companyId: applied.companyId?.trim() || undefined,
    status: (applied.status.trim() || undefined) as OutboundOrderStatus | undefined,
    orderSearch: applied.orderSearch.trim() || undefined,
    createdFrom: applied.createdFrom.trim() || undefined,
    createdTo: applied.createdTo.trim() || undefined,
    quickDirectedOnly: false as const,
  }
}
