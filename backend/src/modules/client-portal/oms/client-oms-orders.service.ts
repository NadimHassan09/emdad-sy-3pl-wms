import { Injectable } from '@nestjs/common';
import { CodRecordStatus, OmsCodStatus, Prisma } from '@prisma/client';

import { clientAuthPrincipal } from '../../../common/auth/client-auth-principal';
import { ClientPrincipal } from '../../../common/auth/client-principal.types';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { withTenantRls } from '../../../common/prisma/tenant-rls';
import { ListOmsOrdersQueryDto } from '../../oms/dto/list-oms-orders-query.dto';
import { CreateOmsOrderDto } from '../../oms/dto/oms-order.dto';
import { OmsOrdersService } from '../../oms/oms-orders.service';
import { CreateClientOmsOrderDto } from './dto/create-client-oms-order.dto';
import { ClientCodReportQueryDto } from './dto/client-cod-report-query.dto';
import { ListClientOmsOrdersQueryDto } from './dto/list-client-oms-orders-query.dto';

/** Map CodRecord status → legacy portal COD labels. */
function portalCodStatusFromRecord(status: CodRecordStatus): OmsCodStatus {
  switch (status) {
    case CodRecordStatus.available:
      return OmsCodStatus.collected;
    case CodRecordStatus.paid_out:
      return OmsCodStatus.remitted;
    case CodRecordStatus.pending:
    default:
      return OmsCodStatus.pending;
  }
}

function matchesPortalCodFilter(
  portalStatus: OmsCodStatus | null | undefined,
  filter?: string,
): boolean {
  if (!filter?.trim()) return true;
  const f = filter.trim();
  if (f === 'settled') return portalStatus === OmsCodStatus.remitted;
  if (f === 'available') return portalStatus === OmsCodStatus.collected;
  if (f === 'paid_out') return portalStatus === OmsCodStatus.remitted;
  return portalStatus === f;
}

@Injectable()
export class ClientOmsOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly omsOrders: OmsOrdersService,
  ) {}

  async list(client: ClientPrincipal, query: ListClientOmsOrdersQueryDto) {
    const user = clientAuthPrincipal(client);
    const scoped: ListOmsOrdersQueryDto = {
      ...query,
      companyId: client.companyId,
    };
    return this.omsOrders.list(user, scoped);
  }

  async create(client: ClientPrincipal, dto: CreateClientOmsOrderDto) {
    const user = clientAuthPrincipal(client);
    const payload: CreateOmsOrderDto = {
      companyId: client.companyId,
      requiredShipDate: dto.requiredShipDate,
      recipientName: dto.recipientName,
      recipientPhone: dto.recipientPhone,
      city: dto.city,
      district: dto.district,
      addressLine1: dto.addressLine1,
      notes: dto.notes,
      storeChannel: dto.storeChannel,
      paymentMethod: dto.paymentMethod,
      currency: dto.currency ?? 'SYP',
      // Clients must not set shipping fee — admin sets it before/at approval.
      lines: dto.lines.map((l) => ({
        productId: l.productId,
        requestedQuantity: l.requestedQuantity,
        unitPrice: l.unitPrice,
        lineTotal:
          l.unitPrice != null ? l.unitPrice * l.requestedQuantity : undefined,
      })),
    };
    return this.omsOrders.create(user, payload);
  }

  async findOne(client: ClientPrincipal, id: string) {
    const user = clientAuthPrincipal(client);
    return this.omsOrders.findById(id, user);
  }

  async timeline(client: ClientPrincipal, id: string) {
    const user = clientAuthPrincipal(client);
    return this.omsOrders.timeline(id, user);
  }

  /**
   * Client COD report: prefer CodRecord (current amount + adjustments),
   * fall back to OMS order COD fields for legacy rows without a CodRecord.
   */
  async codReport(client: ClientPrincipal, query: ClientCodReportQueryDto) {
    const user = clientAuthPrincipal(client);

    const createdAt: Prisma.DateTimeFilter | undefined =
      query.dateFrom || query.dateTo
        ? {
            ...(query.dateFrom
              ? { gte: new Date(`${query.dateFrom}T00:00:00.000Z`) }
              : {}),
            ...(query.dateTo
              ? { lte: new Date(`${query.dateTo}T23:59:59.999Z`) }
              : {}),
          }
        : undefined;

    return withTenantRls(this.prisma, user, async (tx) => {
      const [codRecords, legacyOrders] = await Promise.all([
        tx.codRecord.findMany({
          where: {
            companyId: client.companyId,
            ...(createdAt
              ? {
                  omsOrder: {
                    paymentMethod: 'COD',
                    createdAt,
                    ...(query.storeChannel?.trim()
                      ? {
                          storeChannel: {
                            contains: query.storeChannel.trim(),
                            mode: 'insensitive',
                          },
                        }
                      : {}),
                  },
                }
              : {
                  omsOrder: {
                    paymentMethod: 'COD',
                    ...(query.storeChannel?.trim()
                      ? {
                          storeChannel: {
                            contains: query.storeChannel.trim(),
                            mode: 'insensitive',
                          },
                        }
                      : {}),
                  },
                }),
          },
          include: {
            adjustments: { select: { amount: true } },
            omsOrder: {
              select: {
                id: true,
                orderNumber: true,
                status: true,
                recipientName: true,
                currency: true,
                createdAt: true,
                deliveredAt: true,
                storeChannel: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        }),
        tx.omsOrder.findMany({
          where: {
            companyId: client.companyId,
            paymentMethod: 'COD',
            codRecord: null,
            ...(createdAt ? { createdAt } : {}),
            ...(query.storeChannel?.trim()
              ? {
                  storeChannel: {
                    contains: query.storeChannel.trim(),
                    mode: 'insensitive',
                  },
                }
              : {}),
          },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            orderNumber: true,
            status: true,
            recipientName: true,
            codAmount: true,
            codStatus: true,
            codCollectedAt: true,
            codRemittedAt: true,
            currency: true,
            createdAt: true,
            deliveredAt: true,
          },
        }),
      ]);

      type Row = {
        id: string;
        orderNumber: string;
        status: string;
        recipientName: string | null;
        codAmount: string | null;
        codStatus: OmsCodStatus | null;
        codCollectedAt: Date | null;
        codRemittedAt: Date | null;
        currency: string | null;
        createdAt: Date;
        deliveredAt: Date | null;
        codRecordId?: string;
      };

      const rows: Row[] = [];

      for (const rec of codRecords) {
        const adjSum = rec.adjustments.reduce(
          (s, a) => s.add(a.amount),
          new Prisma.Decimal(0),
        );
        const current = rec.originalAmount.add(adjSum);
        const portalStatus = portalCodStatusFromRecord(rec.status);
        rows.push({
          id: rec.omsOrder.id,
          orderNumber: rec.omsOrder.orderNumber,
          status: rec.omsOrder.status,
          recipientName: rec.omsOrder.recipientName,
          codAmount: current.toString(),
          codStatus: portalStatus,
          codCollectedAt: rec.availableAt,
          codRemittedAt: rec.paidOutAt,
          currency: rec.currency ?? rec.omsOrder.currency,
          createdAt: rec.omsOrder.createdAt,
          deliveredAt: rec.omsOrder.deliveredAt,
          codRecordId: rec.id,
        });
      }

      for (const order of legacyOrders) {
        rows.push({
          id: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          recipientName: order.recipientName,
          codAmount: order.codAmount?.toString() ?? null,
          codStatus: order.codStatus,
          codCollectedAt: order.codCollectedAt,
          codRemittedAt: order.codRemittedAt,
          currency: order.currency,
          createdAt: order.createdAt,
          deliveredAt: order.deliveredAt,
        });
      }

      const filtered = rows.filter((r) =>
        matchesPortalCodFilter(r.codStatus, query.codStatus),
      );
      filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      const total = filtered.length;
      const page = filtered.slice(query.offset, query.offset + query.limit);
      const totalCodAmount = filtered.reduce((sum, r) => {
        const n = Number(r.codAmount);
        return sum + (Number.isFinite(n) ? n : 0);
      }, 0);

      return {
        items: page,
        total,
        limit: query.limit,
        offset: query.offset,
        summary: {
          orderCount: total,
          totalCodAmount: String(totalCodAmount),
        },
      };
    });
  }
}
