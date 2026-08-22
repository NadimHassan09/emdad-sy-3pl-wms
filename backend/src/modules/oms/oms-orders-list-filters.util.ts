import { Prisma } from '@prisma/client';

import type { ListOmsOrdersQueryDto } from './dto/list-oms-orders-query.dto';

const FULL_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type OmsTotalOperator = 'eq' | 'gt' | 'gte' | 'lt' | 'lte';

/** Parse a finite non-negative money amount from query text. */
export function parseOmsTotalFilterValue(raw: string | undefined): Prisma.Decimal | null {
  if (raw == null) return null;
  const t = raw.trim();
  if (!t) return null;
  if (!/^\d+(\.\d{1,4})?$/.test(t)) return null;
  try {
    const d = new Prisma.Decimal(t);
    if (!d.isFinite() || d.isNegative()) return null;
    return d;
  } catch {
    return null;
  }
}

/**
 * Append field-specific OMS list filters (AND semantics).
 * Shared by list + CSV export via buildListWhere.
 */
export function appendOmsOrderFieldFilters(
  query: Pick<
    ListOmsOrdersQueryDto,
    | 'orderSearch'
    | 'orderId'
    | 'customer'
    | 'phone'
    | 'city'
    | 'totalOp'
    | 'totalValue'
  >,
  where: Prisma.OmsOrderWhereInput,
  andParts: Prisma.OmsOrderWhereInput[],
): void {
  if (query.orderSearch?.trim()) {
    const t = query.orderSearch.trim();
    const orParts: Prisma.OmsOrderWhereInput[] = [
      { orderNumber: { contains: t, mode: 'insensitive' } },
      { recipientName: { contains: t, mode: 'insensitive' } },
      { recipientPhone: { contains: t, mode: 'insensitive' } },
      { externalReference: { contains: t, mode: 'insensitive' } },
      { clientReference: { contains: t, mode: 'insensitive' } },
    ];
    if (FULL_UUID.test(t)) orParts.push({ id: t });
    andParts.push({ OR: orParts });
  }

  if (query.orderId?.trim()) {
    const t = query.orderId.trim();
    const orParts: Prisma.OmsOrderWhereInput[] = [
      { orderNumber: { contains: t, mode: 'insensitive' } },
      { externalReference: { contains: t, mode: 'insensitive' } },
      { clientReference: { contains: t, mode: 'insensitive' } },
    ];
    if (FULL_UUID.test(t)) orParts.push({ id: t });
    andParts.push({ OR: orParts });
  }

  if (query.customer?.trim()) {
    andParts.push({
      recipientName: { contains: query.customer.trim(), mode: 'insensitive' },
    });
  }

  if (query.phone?.trim()) {
    andParts.push({
      recipientPhone: { contains: query.phone.trim(), mode: 'insensitive' },
    });
  }

  if (query.city?.trim()) {
    andParts.push({
      city: { contains: query.city.trim(), mode: 'insensitive' },
    });
  }

  const totalValue = parseOmsTotalFilterValue(query.totalValue);
  const op = query.totalOp;
  if (totalValue != null && op) {
    const filter: Prisma.DecimalNullableFilter =
      op === 'eq'
        ? { equals: totalValue }
        : op === 'gt'
          ? { gt: totalValue }
          : op === 'gte'
            ? { gte: totalValue }
            : op === 'lt'
              ? { lt: totalValue }
              : { lte: totalValue };
    // Displayed list total is maintained on write as `subtotal` (lines + shipping).
    where.subtotal = filter;
  }
}
