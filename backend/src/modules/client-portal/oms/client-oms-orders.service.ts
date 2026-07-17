import { Injectable } from '@nestjs/common';
import { OmsCodStatus, Prisma } from '@prisma/client';

import { clientAuthPrincipal } from '../../../common/auth/client-auth-principal';
import { ClientPrincipal } from '../../../common/auth/client-principal.types';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { withTenantRls } from '../../../common/prisma/tenant-rls';
import { ListOmsOrdersQueryDto } from '../../oms/dto/list-oms-orders-query.dto';
import { CreateOmsOrderDto } from '../../oms/dto/oms-order.dto';
import { OmsOrderEventsService } from '../../oms/oms-order-events.service';
import { OmsOrdersService } from '../../oms/oms-orders.service';
import { CreateClientOmsOrderDto } from './dto/create-client-oms-order.dto';
import { ListClientOmsOrdersQueryDto } from './dto/list-client-oms-orders-query.dto';

export type ClientCodReportQuery = {
  limit: number;
  offset: number;
  codStatus?: string;
  dateFrom?: string;
  dateTo?: string;
};

@Injectable()
export class ClientOmsOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly omsOrders: OmsOrdersService,
    private readonly events: OmsOrderEventsService,
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
    const order = await this.omsOrders.findById(id, user);
    return order;
  }

  async timeline(client: ClientPrincipal, id: string) {
    const user = clientAuthPrincipal(client);
    return this.omsOrders.timeline(id, user);
  }

  async codReport(client: ClientPrincipal, query: ClientCodReportQuery) {
    const user = clientAuthPrincipal(client);
    const where: Prisma.OmsOrderWhereInput = {
      companyId: client.companyId,
      paymentMethod: 'COD',
    };

    if (query.codStatus?.trim()) {
      const status = query.codStatus.trim() as OmsCodStatus;
      if (Object.values(OmsCodStatus).includes(status)) {
        where.codStatus = status;
      }
    }

    if (query.dateFrom || query.dateTo) {
      const createdAt: Prisma.DateTimeFilter = {};
      if (query.dateFrom) createdAt.gte = new Date(`${query.dateFrom}T00:00:00.000Z`);
      if (query.dateTo) createdAt.lte = new Date(`${query.dateTo}T23:59:59.999Z`);
      where.createdAt = createdAt;
    }

    return withTenantRls(this.prisma, user, async (tx) => {
      const [items, total, summary] = await Promise.all([
        tx.omsOrder.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: query.limit,
          skip: query.offset,
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
        tx.omsOrder.count({ where }),
        tx.omsOrder.aggregate({
          where,
          _sum: { codAmount: true },
          _count: { id: true },
        }),
      ]);

      return {
        items: items.map((row) => ({
          ...row,
          codAmount: row.codAmount?.toString() ?? null,
        })),
        total,
        limit: query.limit,
        offset: query.offset,
        summary: {
          orderCount: summary._count.id,
          totalCodAmount: summary._sum.codAmount?.toString() ?? '0',
        },
      };
    });
  }
}
