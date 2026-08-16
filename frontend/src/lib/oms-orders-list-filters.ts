import type { OmsOrderStatus } from '../api/oms';

export type OmsTotalOperator = 'eq' | 'gt' | 'gte' | 'lt' | 'lte' | '';

export type OmsOrdersListFilters = {
  orderSearch: string;
  status: string;
  orderId: string;
  companyId: string;
  customer: string;
  phone: string;
  city: string;
  totalOp: OmsTotalOperator;
  totalValue: string;
};

export const OMS_ORDERS_FILTER_DEFAULTS: OmsOrdersListFilters = {
  orderSearch: '',
  status: '',
  orderId: '',
  companyId: '',
  customer: '',
  phone: '',
  city: '',
  totalOp: 'gte',
  totalValue: '',
};

export const OMS_TOTAL_OPERATOR_OPTIONS: Array<{
  value: Exclude<OmsTotalOperator, ''>;
  label: string;
}> = [
  { value: 'eq', label: 'Equals' },
  { value: 'gt', label: 'Greater than' },
  { value: 'gte', label: 'Greater than or equal' },
  { value: 'lt', label: 'Less than' },
  { value: 'lte', label: 'Less than or equal' },
];

export type OmsOrdersListQueryParams = {
  orderSearch?: string;
  orderId?: string;
  companyId?: string;
  customer?: string;
  phone?: string;
  city?: string;
  totalOp?: Exclude<OmsTotalOperator, ''>;
  totalValue?: string;
  status?: OmsOrderStatus;
};

function text(value: unknown): string {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

/**
 * Merge cached / partial filter state with defaults.
 * Needed when older list-cache entries only had orderSearch + status.
 */
export function normalizeOmsOrdersListFilters(
  raw: Partial<OmsOrdersListFilters> | null | undefined,
): OmsOrdersListFilters {
  const src = raw ?? {};
  const totalOpRaw = text(src.totalOp);
  const totalOp: OmsTotalOperator =
    totalOpRaw === 'eq' ||
    totalOpRaw === 'gt' ||
    totalOpRaw === 'gte' ||
    totalOpRaw === 'lt' ||
    totalOpRaw === 'lte'
      ? totalOpRaw
      : OMS_ORDERS_FILTER_DEFAULTS.totalOp;

  return {
    orderSearch: text(src.orderSearch),
    status: text(src.status),
    orderId: text(src.orderId),
    companyId: text(src.companyId),
    customer: text(src.customer),
    phone: text(src.phone),
    city: text(src.city),
    totalOp,
    totalValue: text(src.totalValue),
  };
}

/** Canonical list/export query from applied filter state. */
export function buildOmsOrdersListParams(
  appliedRaw: Partial<OmsOrdersListFilters> | null | undefined,
): OmsOrdersListQueryParams {
  const applied = normalizeOmsOrdersListFilters(appliedRaw);
  const totalValue = applied.totalValue.trim();
  const totalOp =
    totalValue && applied.totalOp
      ? (applied.totalOp as Exclude<OmsTotalOperator, ''>)
      : undefined;

  return {
    orderSearch: applied.orderSearch.trim() || undefined,
    orderId: applied.orderId.trim() || undefined,
    companyId: applied.companyId.trim() || undefined,
    customer: applied.customer.trim() || undefined,
    phone: applied.phone.trim() || undefined,
    city: applied.city.trim() || undefined,
    totalOp,
    totalValue: totalOp ? totalValue : undefined,
    status: (applied.status.trim() || undefined) as OmsOrderStatus | undefined,
  };
}

/** Count applied advanced filters for the Advanced Filtering badge. */
export function countAppliedOmsAdvancedFilters(
  appliedRaw: Partial<OmsOrdersListFilters> | null | undefined,
): number {
  const applied = normalizeOmsOrdersListFilters(appliedRaw);
  let n = 0;
  if (applied.orderId.trim()) n += 1;
  if (applied.companyId.trim()) n += 1;
  if (applied.customer.trim()) n += 1;
  if (applied.phone.trim()) n += 1;
  if (applied.city.trim()) n += 1;
  if (applied.totalValue.trim() && applied.totalOp) n += 1;
  if (applied.status.trim()) n += 1;
  return n;
}

export function buildOmsAppliedFilterSummary(
  appliedRaw: Partial<OmsOrdersListFilters> | null | undefined,
  opts: {
    clientName?: string | null;
    statusLabel?: string | null;
    isArabic?: boolean;
  } = {},
): string | null {
  const applied = normalizeOmsOrdersListFilters(appliedRaw);
  const parts: string[] = [];
  if (applied.orderId.trim()) {
    parts.push(
      opts.isArabic
        ? `رقم الطلب: ${applied.orderId.trim()}`
        : `Order ID: ${applied.orderId.trim()}`,
    );
  }
  if (applied.companyId.trim()) {
    const name = opts.clientName?.trim() || applied.companyId.trim();
    parts.push(opts.isArabic ? `العميل: ${name}` : `Client: ${name}`);
  }
  if (applied.customer.trim()) {
    parts.push(
      opts.isArabic
        ? `الزبون: ${applied.customer.trim()}`
        : `Customer: ${applied.customer.trim()}`,
    );
  }
  if (applied.phone.trim()) {
    parts.push(
      opts.isArabic ? `الهاتف: ${applied.phone.trim()}` : `Phone: ${applied.phone.trim()}`,
    );
  }
  if (applied.city.trim()) {
    parts.push(
      opts.isArabic ? `المدينة: ${applied.city.trim()}` : `City: ${applied.city.trim()}`,
    );
  }
  if (applied.totalValue.trim() && applied.totalOp) {
    const op =
      OMS_TOTAL_OPERATOR_OPTIONS.find((o) => o.value === applied.totalOp)?.label ??
      applied.totalOp;
    parts.push(
      opts.isArabic
        ? `الإجمالي: ${op} ${applied.totalValue.trim()}`
        : `Total: ${op} ${applied.totalValue.trim()}`,
    );
  }
  if (applied.status.trim()) {
    const label = opts.statusLabel?.trim() || applied.status.trim();
    parts.push(opts.isArabic ? `الحالة: ${label}` : `Status: ${label}`);
  }
  if (applied.orderSearch.trim()) {
    parts.push(
      opts.isArabic
        ? `بحث: ${applied.orderSearch.trim()}`
        : `Search: ${applied.orderSearch.trim()}`,
    );
  }
  return parts.length > 0 ? parts.join(' · ') : null;
}
