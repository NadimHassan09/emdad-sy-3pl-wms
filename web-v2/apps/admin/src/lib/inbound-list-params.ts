import type { InboundOrderStatus } from '@/api/inbound'

export type InboundListFilterState = {
  orderSearch: string
  status: string
  createdFrom: string
  createdTo: string
  companyId: string
}

export const INBOUND_LIST_FILTER_DEFAULTS: InboundListFilterState = {
  orderSearch: '',
  status: '',
  createdFrom: '',
  createdTo: '',
  companyId: '',
}

/** Canonical list/export query from applied inbound filters. */
export function buildInboundListParams(
  applied: InboundListFilterState,
  fallbackWarehouseId?: string,
) {
  return {
    warehouseId: fallbackWarehouseId || undefined,
    companyId: applied.companyId?.trim() || undefined,
    status: (applied.status?.trim() || undefined) as InboundOrderStatus | undefined,
    orderSearch: applied.orderSearch?.trim() || undefined,
    createdFrom: applied.createdFrom?.trim() || undefined,
    createdTo: applied.createdTo?.trim() || undefined,
  }
}

export function countAppliedInboundAdvancedFilters(applied: InboundListFilterState): number {
  let n = 0
  if (applied.companyId?.trim()) n += 1
  if (applied.createdFrom?.trim()) n += 1
  if (applied.createdTo?.trim()) n += 1
  if (applied.status?.trim()) n += 1
  return n
}
