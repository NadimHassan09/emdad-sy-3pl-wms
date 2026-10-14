import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuthPrincipal } from '../../common/auth/current-user.types';
import { PrismaService } from '../../common/prisma/prisma.service';
import { withTenantRls } from '../../common/prisma/tenant-rls';
import { summarizeBatchMembers, type BatchMemberSnapshot } from './oms-batch-summary';
import { serializeOmsOrderListItem, type OmsOrderWithRelations } from './oms-order.mapper';

const ACTIVE = { removedAt: null } as const;

@Injectable()
export class OmsBatchService {
  constructor(private readonly prisma: PrismaService) {}

  async create(user: AuthPrincipal, ids: string[], name?: string) {
    const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
    return withTenantRls(this.prisma, user, async (tx) => {
      const orders = await tx.omsOrder.findMany({
        where: {
          id: { in: unique },
          ...(user.companyId ? { companyId: user.companyId } : {}),
        },
        select: { id: true },
      });
      if (orders.length !== unique.length) {
        throw new BadRequestException('Some selected orders were not found.');
      }
      const seq = await tx.$queryRaw<Array<{ n: bigint }>>(
        Prisma.sql`SELECT nextval('oms_batch_number_seq') AS n`,
      );
      const batchNumber = `BATCH-${seq[0]?.n?.toString() ?? ''}`;
      const batch = await tx.omsBatch.create({
        data: {
          batchNumber,
          name: name?.trim() || null,
          createdBy: user.id,
          orders: {
            create: unique.map((omsOrderId) => ({ omsOrderId })),
          },
        },
        select: { id: true, batchNumber: true },
      });
      return batch;
    });
  }

  async list(user: AuthPrincipal, search?: string) {
    const q = search?.trim();
    return withTenantRls(this.prisma, user, async (tx) => {
      const batches = await tx.omsBatch.findMany({
        where: {
          ...(q
            ? {
                OR: [
                  { batchNumber: { contains: q, mode: 'insensitive' } },
                  { name: { contains: q, mode: 'insensitive' } },
                ],
              }
            : {}),
          orders: {
            some: {
              ...ACTIVE,
              order: user.companyId ? { companyId: user.companyId } : {},
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: {
          creator: { select: { fullName: true } },
          orders: {
            where: ACTIVE,
            select: {
              issueNote: true,
              order: {
                select: {
                  status: true,
                  outboundOrder: { select: { status: true } },
                },
              },
            },
          },
        },
      });
      return batches.map((batch) => {
        const members: BatchMemberSnapshot[] = batch.orders.map((row) => ({
          status: row.order.status,
          outboundStatus: row.order.outboundOrder?.status ?? null,
          issueNote: row.issueNote,
        }));
        return {
          id: batch.id,
          batchNumber: batch.batchNumber,
          name: batch.name,
          createdAt: batch.createdAt,
          createdByName: batch.creator.fullName,
          ...summarizeBatchMembers(members),
        };
      });
    });
  }

  async get(user: AuthPrincipal, id: string) {
    return withTenantRls(this.prisma, user, async (tx) => {
      const batch = await tx.omsBatch.findFirst({
        where: {
          id,
          orders: {
            some: {
              order: user.companyId ? { companyId: user.companyId } : {},
            },
          },
        },
        include: {
          creator: { select: { fullName: true } },
          orders: {
            where: {
              ...ACTIVE,
              order: user.companyId ? { companyId: user.companyId } : {},
            },
            orderBy: { order: { orderNumber: 'asc' } },
            include: {
              order: {
                include: {
                  company: { select: { id: true, name: true } },
                  outboundOrder: {
                    select: {
                      id: true,
                      orderNumber: true,
                      status: true,
                      trackingNumber: true,
                      carrier: true,
                      shippingMethod: true,
                      shippingProviderCode: true,
                      shippingServiceId: true,
                      shippingQuotedPrice: true,
                      shippingQuotedCurrency: true,
                      carrierShipments: {
                        select: { status: true, externalAwb: true, providerCode: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });
      if (!batch) throw new NotFoundException('Batch not found.');
      const rows = batch.orders.map((membership) => ({
        membershipId: membership.id,
        issueNote: membership.issueNote,
        order: serializeOmsOrderListItem({
          ...membership.order,
          lines: [],
        } as OmsOrderWithRelations),
      }));
      const summary = summarizeBatchMembers(
        rows.map((row) => ({
          status: row.order.status,
          outboundStatus: row.order.linkedOutboundOrder?.status ?? null,
          issueNote: row.issueNote,
        })),
      );
      return {
        id: batch.id,
        batchNumber: batch.batchNumber,
        name: batch.name,
        createdAt: batch.createdAt,
        createdByName: batch.creator.fullName,
        ...summary,
        orders: rows,
      };
    });
  }

  /**
   * Add orders to an existing batch.
   * Cap is per request (max 1000 ids) — not a total batch membership ceiling.
   * Soft-removed members for the same order are re-activated.
   */
  async addOrders(user: AuthPrincipal, batchId: string, ids: string[]) {
    const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
    if (unique.length === 0) {
      throw new BadRequestException('Select at least one order to add.');
    }
    if (unique.length > 1000) {
      throw new BadRequestException('You can add at most 1000 orders in one request.');
    }
    return withTenantRls(this.prisma, user, async (tx) => {
      const batch = await tx.omsBatch.findFirst({
        where: { id: batchId },
        select: { id: true },
      });
      if (!batch) throw new NotFoundException('Batch not found.');

      const orders = await tx.omsOrder.findMany({
        where: {
          id: { in: unique },
          ...(user.companyId ? { companyId: user.companyId } : {}),
        },
        select: { id: true },
      });
      if (orders.length !== unique.length) {
        throw new BadRequestException('Some selected orders were not found.');
      }

      const existing = await tx.omsBatchOrder.findMany({
        where: { batchId, omsOrderId: { in: unique } },
        select: { id: true, omsOrderId: true, removedAt: true },
      });
      const byOrderId = new Map(existing.map((row) => [row.omsOrderId, row]));
      let added = 0;
      let reactivated = 0;
      let alreadyActive = 0;

      for (const omsOrderId of unique) {
        const row = byOrderId.get(omsOrderId);
        if (!row) {
          await tx.omsBatchOrder.create({ data: { batchId, omsOrderId } });
          added += 1;
          continue;
        }
        if (row.removedAt) {
          await tx.omsBatchOrder.update({
            where: { id: row.id },
            data: { removedAt: null, issueNote: null },
          });
          reactivated += 1;
          continue;
        }
        alreadyActive += 1;
      }

      if (added + reactivated === 0) {
        throw new BadRequestException('All selected orders are already in this batch.');
      }
      return { added, reactivated, alreadyActive, total: added + reactivated };
    });
  }

  async removeOrders(user: AuthPrincipal, batchId: string, ids: string[]) {
    return this.touchMemberships(user, batchId, ids, { removedAt: new Date(), issueNote: null });
  }

  async flagOrders(user: AuthPrincipal, batchId: string, ids: string[], note: string) {
    const trimmed = note.trim();
    if (!trimmed) throw new BadRequestException('Issue note is required.');
    return this.touchMemberships(user, batchId, ids, { issueNote: trimmed });
  }

  async clearFlags(user: AuthPrincipal, batchId: string, ids: string[]) {
    return this.touchMemberships(user, batchId, ids, { issueNote: null });
  }

  private async touchMemberships(
    user: AuthPrincipal,
    batchId: string,
    ids: string[],
    data: Prisma.OmsBatchOrderUpdateManyMutationInput,
  ) {
    const unique = [...new Set(ids)];
    return withTenantRls(this.prisma, user, async (tx) => {
      const batch = await tx.omsBatch.findFirst({
        where: { id: batchId },
        select: { id: true },
      });
      if (!batch) throw new NotFoundException('Batch not found.');
      const result = await tx.omsBatchOrder.updateMany({
        where: {
          batchId,
          removedAt: null,
          omsOrderId: { in: unique },
          order: user.companyId ? { companyId: user.companyId } : {},
        },
        data,
      });
      if (result.count === 0) {
        throw new BadRequestException('No active batch orders matched that request.');
      }
      return { updated: result.count };
    });
  }
}
