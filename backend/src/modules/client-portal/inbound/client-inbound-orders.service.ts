import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InboundOrderStatus, Prisma } from '@prisma/client';

import { clientAuthPrincipal } from '../../../common/auth/client-auth-principal';
import { ClientPrincipal } from '../../../common/auth/client-principal.types';
import { AuditLogService } from '../../../common/audit/audit-log.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { withTenantRls } from '../../../common/prisma/tenant-rls';
import { assertCalendarDateNotBeforeToday } from '../../../common/utils/order-planning-date';
import { assertClientMayChangeWmsOrder } from '../shared/client-order-lock';
import { UpdateClientInboundOrderDto } from './dto/update-client-inbound-order.dto';
import { CreateInboundOrderDto } from '../../inbound/dto/create-inbound.dto';
import { ListInboundQueryDto } from '../../inbound/dto/list-inbound-query.dto';
import { InboundService } from '../../inbound/inbound.service';
import {
  CLIENT_INBOUND_IN_PROGRESS_STATUSES,
  ClientListInboundQueryDto,
} from './dto/client-list-inbound-query.dto';

/** Public media URL path consumed by client `clientMediaSrc()`. */
function toProductImageUrl(imagePath: string | null | undefined): string | null {
  if (!imagePath?.trim()) return null;
  return `/media/${imagePath.replace(/^\/+/, '')}`;
}

type ListQueryWithStatusIn = ListInboundQueryDto & {
  statusIn?: InboundOrderStatus[];
};

@Injectable()
export class ClientInboundOrdersService {
  constructor(
    private readonly inbound: InboundService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async findOne(client: ClientPrincipal, id: string) {
    const order = await this.inbound.findById(id, clientAuthPrincipal(client));
    return {
      ...order,
      lines: order.lines.map((line) => ({
        ...line,
        product: {
          ...line.product,
          imageUrl: toProductImageUrl(line.product.imagePath),
        },
      })),
    };
  }

  async list(client: ClientPrincipal, query: ClientListInboundQueryDto) {
    const principal = clientAuthPrincipal(client);
    const base: ListQueryWithStatusIn = {
      limit: query.limit,
      offset: query.offset,
      orderSearch: query.orderSearch,
      createdFrom: query.createdFrom,
      createdTo: query.createdTo,
      companyId: client.companyId,
    };

    if (query.status === 'in_progress') {
      base.statusIn = CLIENT_INBOUND_IN_PROGRESS_STATUSES;
    } else if (query.status) {
      base.status = query.status as InboundOrderStatus;
    }

    return this.inbound.list(principal, base);
  }

  async listForExport(
    client: ClientPrincipal,
    query: { orderSearch?: string; status?: string; createdFrom?: string; createdTo?: string },
    opts: { maxRows: number; ids?: string[] },
  ) {
    const principal = clientAuthPrincipal(client);
    if (opts.ids?.length) {
      const unique = Array.from(new Set(opts.ids.map((id) => id.trim()).filter(Boolean)));
      return withTenantRls(this.prisma, principal, async (tx) => {
        const rows = await tx.inboundOrder.findMany({
          where: {
            companyId: client.companyId,
            id: { in: unique.slice(0, opts.maxRows) },
          },
          orderBy: { createdAt: 'desc' },
          include: {
            company: { select: { id: true, name: true } },
            lines: {
              orderBy: { lineNumber: 'asc' },
              select: {
                expectedQuantity: true,
                product: { select: { name: true, weightKg: true } },
              },
            },
          },
        });
        return {
          items: rows,
          total: rows.length,
          truncated: unique.length > rows.length,
        };
      });
    }

    const base: ListQueryWithStatusIn = {
      orderSearch: query.orderSearch,
      createdFrom: query.createdFrom,
      createdTo: query.createdTo,
      companyId: client.companyId,
      limit: opts.maxRows,
      offset: 0,
    };
    if (query.status === 'in_progress') {
      base.statusIn = CLIENT_INBOUND_IN_PROGRESS_STATUSES;
    } else if (query.status) {
      base.status = query.status as InboundOrderStatus;
    }

    return this.inbound.listForExport(principal, base, { maxRows: opts.maxRows });
  }

  async create(client: ClientPrincipal, dto: CreateInboundOrderDto) {
    // Warehouse admin completes dock / putaway / confirm on the admin plan UI.
    return this.inbound.create(
      clientAuthPrincipal(client),
      { ...dto, executionMode: 'admin', executionPlan: undefined },
      { pendingClientApproval: true },
    );
  }

  /** Client edit of an inbound order, allowed only until the warehouse approves it. */
  async updateEditable(client: ClientPrincipal, id: string, dto: UpdateClientInboundOrderDto) {
    const principal = clientAuthPrincipal(client);
    const updated = await withTenantRls(this.prisma, principal, async (tx) => {
      const order = await tx.inboundOrder.findFirst({
        where: { id, companyId: client.companyId },
        select: { id: true, status: true, companyId: true },
      });
      if (!order) throw new NotFoundException('Inbound order not found.');
      assertClientMayChangeWmsOrder(order.status);

      if (dto.expectedArrivalDate) {
        assertCalendarDateNotBeforeToday(dto.expectedArrivalDate, 'Expected arrival date');
      }
      if (dto.lines) {
        const ids = dto.lines.map((l) => l.productId);
        if (new Set(ids).size !== ids.length) {
          throw new BadRequestException('Each product can only appear once in an order.');
        }
        const products = await tx.product.findMany({
          where: { id: { in: ids }, companyId: client.companyId },
          select: { id: true },
        });
        if (products.length !== ids.length) {
          throw new BadRequestException('One or more products were not found for your company.');
        }
        await tx.inboundOrderLine.deleteMany({ where: { inboundOrderId: id } });
        await tx.inboundOrderLine.createMany({
          data: dto.lines.map((l, idx) => ({
            inboundOrderId: id,
            productId: l.productId,
            expectedQuantity: new Prisma.Decimal(l.expectedQuantity),
            expectedLotNumber: l.expectedLotNumber?.trim() || null,
            expectedExpiryDate: l.expectedExpiryDate ? new Date(l.expectedExpiryDate) : null,
            lineNumber: idx + 1,
          })),
        });
      }
      return tx.inboundOrder.update({
        where: { id },
        data: {
          expectedArrivalDate: dto.expectedArrivalDate ? new Date(dto.expectedArrivalDate) : undefined,
          clientReference: dto.clientReference,
          notes: dto.notes,
          updatedAt: new Date(),
        },
        select: { id: true, orderNumber: true, status: true, companyId: true },
      });
    });
    await this.audit.log(
      this.audit.fromPrincipal(principal, {
        action: 'INBOUND_CLIENT_EDITED',
        resourceType: 'inbound_order',
        resourceId: updated.id,
        companyId: updated.companyId,
        newState: { status: updated.status, linesReplaced: !!dto.lines },
      }),
    );
    return this.findOne(client, id);
  }

  /** Client removal of an inbound order, allowed only until the warehouse approves it. */
  async removeUnapproved(client: ClientPrincipal, id: string) {
    const principal = clientAuthPrincipal(client);
    const order = await this.inbound.findById(id, principal);
    if (order.companyId !== client.companyId) throw new NotFoundException('Inbound order not found.');
    assertClientMayChangeWmsOrder(order.status);
    await this.inbound.cancel(id, principal);
    return this.inbound.remove(id, principal);
  }

  async findByExternalReference(client: ClientPrincipal, externalReference: string) {
    return this.inbound.findByExternalReference(
      clientAuthPrincipal(client),
      client.companyId,
      externalReference,
    );
  }

  async findByOrderNumber(client: ClientPrincipal, orderNumber: string) {
    return this.inbound.findByOrderNumber(
      clientAuthPrincipal(client),
      client.companyId,
      orderNumber,
    );
  }
}
