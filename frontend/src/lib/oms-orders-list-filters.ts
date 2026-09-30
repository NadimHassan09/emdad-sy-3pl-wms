import type { OmsOrderStatus } from '../api/oms';

export type OmsTotalOperator = 'eq' | 'gt' | 'gte' | 'lt' | 'lte' | '';

export type OmsOrdersListFilters = {
  orderSearch: string;
  status: string;
  orderId: string;
  startOrderNo: string;
  endOrderNo: string;
  companyId: string;
  customer: string;
  phone: string;
  city: string;
  carrier: string;
  totalOp: OmsTotalOperator;
  totalValue: string;
};

export const OMS_ORDERS_FILTER_DEFAULTS: OmsOrdersListFilters = {
  orderSearch: '',
  status: '',
  orderId: '',
  startOrderNo: '',
  endOrderNo: '',
  companyId: '',
  customer: '',
  phone: '',
  city: '',
  carrier: '',
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
  startOrderNo?: string;
  endOrderNo?: string;
  companyId?: string;
  customer?: string;
  phone?: string;
  city?: string;
  carrier?: string;
  totalOp?: Exclude<OmsTotalOperator, ''>;
  totalValue?: string;
  status?: OmsOrderStatus;
};

function text(value: unknown): string {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

export interface ParsedOmsOrderNumber {
  raw: string;
  normalized: string;
  prefix: string;
  year: number;
  sequence: number;
}

export function parseAndNormalizeOmsOrderNumber(
  input?: string | null,
): ParsedOmsOrderNumber | null {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  const fullMatch = trimmed.match(/^([A-Za-z]+)-(\d{4})-(\d+)$/);
  if (fullMatch) {
    const prefix = fullMatch[1].toUpperCase();
    const year = parseInt(fullMatch[2], 10);
    const seq = parseInt(fullMatch[3], 10);
    return {
      raw: trimmed,
      normalized: `${prefix}-${year}-${String(seq).padStart(5, '0')}`,
      prefix,
      year,
      sequence: seq,
    };
  }

  const yearSeqMatch = trimmed.match(/^(\d{4})-(\d+)$/);
  if (yearSeqMatch) {
    const prefix = 'OMS';
    const year = parseInt(yearSeqMatch[1], 10);
    const seq = parseInt(yearSeqMatch[2], 10);
    return {
      raw: trimmed,
      normalized: `${prefix}-${year}-${String(seq).padStart(5, '0')}`,
      prefix,
      year,
      sequence: seq,
    };
  }

  const seqOnlyMatch = trimmed.match(/^(\d{1,8})$/);
  if (seqOnlyMatch) {
    const prefix = 'OMS';
    const year = new Date().getFullYear();
    const seq = parseInt(seqOnlyMatch[1], 10);
    return {
      raw: trimmed,
      normalized: `${prefix}-${year}-${String(seq).padStart(5, '0')}`,
      prefix,
      year,
      sequence: seq,
    };
  }

  return null;
}

export function validateOmsOrderRange(
  startRaw?: string | null,
  endRaw?: string | null,
  isArabic?: boolean,
): string | null {
  const hasStart = Boolean(startRaw?.trim());
  const hasEnd = Boolean(endRaw?.trim());
  if (!hasStart && !hasEnd) return null;

  let startParsed: ParsedOmsOrderNumber | null = null;
  if (hasStart) {
    startParsed = parseAndNormalizeOmsOrderNumber(startRaw);
    if (!startParsed) {
      return isArabic
        ? `صيغة رقم طلب البداية غير صحيحة "${startRaw?.trim()}". الصيغة المتوقعة: OMS-2026-03700.`
        : `Invalid Start Order No. format "${startRaw?.trim()}". Expected: OMS-2026-03700.`;
    }
  }

  let endParsed: ParsedOmsOrderNumber | null = null;
  if (hasEnd) {
    endParsed = parseAndNormalizeOmsOrderNumber(endRaw);
    if (!endParsed) {
      return isArabic
        ? `صيغة رقم طلب النهاية غير صحيحة "${endRaw?.trim()}". الصيغة المتوقعة: OMS-2026-03800.`
        : `Invalid End Order No. format "${endRaw?.trim()}". Expected: OMS-2026-03800.`;
    }
  }

  if (startParsed && endParsed) {
    const isGreater =
      startParsed.year > endParsed.year ||
      (startParsed.year === endParsed.year &&
        startParsed.sequence > endParsed.sequence) ||
      (startParsed.year === endParsed.year &&
        startParsed.sequence === endParsed.sequence &&
        startParsed.normalized > endParsed.normalized);

    if (isGreater) {
      return isArabic
        ? `رقم طلب البداية (${startParsed.normalized}) يجب أن يكون أقل من أو يساوي رقم طلب النهاية (${endParsed.normalized}).`
        : `Start Order No. (${startParsed.normalized}) must be less than or equal to End Order No. (${endParsed.normalized}).`;
    }
  }

  return null;
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
    startOrderNo: text(src.startOrderNo),
    endOrderNo: text(src.endOrderNo),
    companyId: text(src.companyId),
    customer: text(src.customer),
    phone: text(src.phone),
    city: text(src.city),
    carrier: text(src.carrier),
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

  const startOrderNo = applied.startOrderNo.trim()
    ? parseAndNormalizeOmsOrderNumber(applied.startOrderNo)?.normalized ??
      applied.startOrderNo.trim()
    : undefined;
  const endOrderNo = applied.endOrderNo.trim()
    ? parseAndNormalizeOmsOrderNumber(applied.endOrderNo)?.normalized ??
      applied.endOrderNo.trim()
    : undefined;

  return {
    orderSearch: applied.orderSearch.trim() || undefined,
    orderId: applied.orderId.trim() || undefined,
    startOrderNo,
    endOrderNo,
    companyId: applied.companyId.trim() || undefined,
    customer: applied.customer.trim() || undefined,
    phone: applied.phone.trim() || undefined,
    city: applied.city.trim() || undefined,
    carrier: applied.carrier.trim() || undefined,
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
  if (applied.startOrderNo.trim()) n += 1;
  if (applied.endOrderNo.trim()) n += 1;
  if (applied.companyId.trim()) n += 1;
  if (applied.customer.trim()) n += 1;
  if (applied.phone.trim()) n += 1;
  if (applied.city.trim()) n += 1;
  if (applied.carrier.trim()) n += 1;
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
  if (applied.startOrderNo.trim() && applied.endOrderNo.trim()) {
    const s =
      parseAndNormalizeOmsOrderNumber(applied.startOrderNo)?.normalized ??
      applied.startOrderNo.trim();
    const e =
      parseAndNormalizeOmsOrderNumber(applied.endOrderNo)?.normalized ??
      applied.endOrderNo.trim();
    parts.push(
      opts.isArabic
        ? `نطاق الطلبات: ${s} إلى ${e}`
        : `Order range: ${s} to ${e}`,
    );
  } else if (applied.startOrderNo.trim()) {
    const s =
      parseAndNormalizeOmsOrderNumber(applied.startOrderNo)?.normalized ??
      applied.startOrderNo.trim();
    parts.push(opts.isArabic ? `من الطلب: ${s}` : `From order: ${s}`);
  } else if (applied.endOrderNo.trim()) {
    const e =
      parseAndNormalizeOmsOrderNumber(applied.endOrderNo)?.normalized ??
      applied.endOrderNo.trim();
    parts.push(opts.isArabic ? `إلى الطلب: ${e}` : `To order: ${e}`);
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
  if (applied.carrier.trim()) {
    parts.push(
      opts.isArabic
        ? `شركة الشحن: ${applied.carrier.trim()}`
        : `Carrier: ${applied.carrier.trim()}`,
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
  if (applied.status.trim() && opts.statusLabel?.trim()) {
    const label = opts.statusLabel.trim();
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
