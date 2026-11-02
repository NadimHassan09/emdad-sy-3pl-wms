import { CodRecordStatus, Prisma } from '@prisma/client';

export type CodListFilterInput = {
  companyId?: string;
  status?: CodRecordStatus;
  omsOrderId?: string;
  search?: string;
  createdFrom?: string;
  createdTo?: string;
  amountMin?: number;
  amountMax?: number;
};

/** Shared COD list/export filter. Auth must already resolve `companyId`. */
export function buildCodRecordWhere(query: CodListFilterInput): Prisma.CodRecordWhereInput {
  const where: Prisma.CodRecordWhereInput = {};
  if (query.companyId) where.companyId = query.companyId;
  if (query.status) where.status = query.status;
  if (query.omsOrderId) where.omsOrderId = query.omsOrderId;
  if (query.createdFrom || query.createdTo) {
    where.createdAt = {};
    if (query.createdFrom) where.createdAt.gte = new Date(query.createdFrom);
    if (query.createdTo) {
      const end = new Date(query.createdTo);
      if (query.createdTo.length <= 10) end.setUTCHours(23, 59, 59, 999);
      where.createdAt.lte = end;
    }
  }
  if (query.amountMin != null || query.amountMax != null) {
    where.originalAmount = {};
    if (query.amountMin != null) where.originalAmount.gte = query.amountMin;
    if (query.amountMax != null) where.originalAmount.lte = query.amountMax;
  }
  const search = query.search?.trim();
  if (search) {
    where.OR = [
      { company: { name: { contains: search, mode: 'insensitive' } } },
      { omsOrder: { orderNumber: { contains: search, mode: 'insensitive' } } },
      { omsOrder: { recipientName: { contains: search, mode: 'insensitive' } } },
    ];
  }
  return where;
}
