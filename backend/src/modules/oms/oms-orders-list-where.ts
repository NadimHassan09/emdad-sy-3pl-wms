import { Prisma } from '@prisma/client';

import { CompanyAccessService } from '../../common/company-access/company-access.service';
import { readCompanyIdCatalogFilter } from '../../common/auth/company-read-scope';
import { AuthPrincipal } from '../../common/auth/current-user.types';
import { ListOmsOrdersQueryDto } from './dto/list-oms-orders-query.dto';

const FULL_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Shared list/export filter shape (pagination omitted). */
export type OmsOrdersListFilters = Pick<
  ListOmsOrdersQueryDto,
  | 'companyId'
  | 'orderSearch'
  | 'createdFrom'
  | 'createdTo'
  | 'status'
  | 'storeChannel'
  | 'linkStatus'
>;

/**
 * Single source of truth for OMS Orders list filtering.
 * Used by both paginated list and CSV export.
 */
export function buildOmsOrdersListWhere(
  companyAccess: CompanyAccessService,
  user: AuthPrincipal,
  query: OmsOrdersListFilters,
): Prisma.OmsOrderWhereInput {
  const where: Prisma.OmsOrderWhereInput = {};
  const andParts: Prisma.OmsOrderWhereInput[] = [];

  const companyId = readCompanyIdCatalogFilter(companyAccess, user, query.companyId);
  if (companyId) where.companyId = companyId;
  if (query.status) where.status = query.status;
  if (query.storeChannel?.trim()) {
    where.storeChannel = { contains: query.storeChannel.trim(), mode: 'insensitive' };
  }
  if (query.linkStatus === 'linked') where.outboundOrderId = { not: null };
  if (query.linkStatus === 'unlinked') where.outboundOrderId = null;

  if (query.orderSearch?.trim()) {
    const t = query.orderSearch.trim();
    const orParts: Prisma.OmsOrderWhereInput[] = [
      { orderNumber: { contains: t, mode: 'insensitive' } },
      { recipientName: { contains: t, mode: 'insensitive' } },
      { recipientPhone: { contains: t, mode: 'insensitive' } },
    ];
    if (FULL_UUID.test(t)) orParts.push({ id: t });
    andParts.push({ OR: orParts });
  }

  if (query.createdFrom || query.createdTo) {
    const createdAt: Prisma.DateTimeFilter = {};
    if (query.createdFrom) createdAt.gte = new Date(`${query.createdFrom}T00:00:00.000Z`);
    if (query.createdTo) createdAt.lte = new Date(`${query.createdTo}T23:59:59.999Z`);
    where.createdAt = createdAt;
  }

  if (andParts.length > 0) where.AND = andParts;
  return where;
}
