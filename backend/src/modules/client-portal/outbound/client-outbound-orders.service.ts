import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { OutboundOrderStatus } from '@prisma/client';

import { clientAuthPrincipal } from '../../../common/auth/client-auth-principal';
import { ClientPrincipal } from '../../../common/auth/client-principal.types';
import { AuditLogService } from '../../../common/audit/audit-log.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { withTenantRls } from '../../../common/prisma/tenant-rls';
import { assertCalendarDateNotBeforeToday } from '../../../common/utils/order-planning-date';
import { assertClientMayChangeWmsOrder } from '../shared/client-order-lock';
import { UpdateClientOutboundOrderDto } from './dto/update-client-outbound-order.dto';
import { CreateOutboundOrderDto } from '../../outbound/dto/create-outbound.dto';
import { ListOutboundQueryDto } from '../../outbound/dto/list-outbound-query.dto';
import { OutboundService } from '../../outbound/outbound.service';
import {
  CLIENT_OUTBOUND_IN_PROGRESS_STATUSES,
  ClientListOutboundQueryDto,
} from './dto/client-list-outbound-query.dto';

/** Public media URL path consumed by client `clientMediaSrc()`. */
function toProductImageUrl(imagePath: string | null | undefined): string | null {
  if (!imagePath?.trim()) return null;
  return `/media/${imagePath.replace(/^\/+/, '')}`;
}

type ListQueryWithStatusIn = ListOutboundQueryDto & {
  statusIn?: OutboundOrderStatus[];
};

@Injectable()
export class ClientOutboundOrdersService {
  constructor(
    private readonly outbound: OutboundService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async findOne(client: ClientPrincipal, id: string) {
    const order = await this.outbound.findById(id, clientAuthPrincipal(client));
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

  async list(client: ClientPrincipal, query: ClientListOutboundQueryDto) {
    const principal = clientAuthPrincipal(client);
    const base: ListQueryWithStatusIn = {
      limit: query.limit,
      offset: query.offset,
      orderSearch: query.orderSearch,
      companyId: client.companyId,
    };

    if (query.status === 'in_progress') {
      base.statusIn = CLIENT_OUTBOUND_IN_PROGRESS_STATUSES;
    } else if (query.status === 'shipped') {
      // Delivered is shown as Shipped in the client portal.
      base.statusIn = [OutboundOrderStatus.shipped, OutboundOrderStatus.delivered];
    } else if (query.status) {
      base.status = query.status as OutboundOrderStatus;
    }

    return this.outbound.list(principal, base);
  }

  async listForExport(
    client: ClientPrincipal,
    query: { orderSearch?: string; status?: string },
    opts: { maxRows: number; ids?: string[] },
  ) {
    const principal = clientAuthPrincipal(client);
    if (opts.ids?.length) {
      const unique = Array.from(new Set(opts.ids.map((id) => id.trim()).filter(Boolean)));
      return withTenantRls(this.prisma, principal, async (tx) => {
        const rows = await tx.outboundOrder.findMany({
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
                requestedQuantity: true,
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
      companyId: client.companyId,
      limit: opts.maxRows,
      offset: 0,
    };
    if (query.status === 'in_progress') {
      base.statusIn = CLIENT_OUTBOUND_IN_PROGRESS_STATUSES;
    } else if (query.status === 'shipped') {
      base.statusIn = [OutboundOrderStatus.shipped, OutboundOrderStatus.delivered];
    } else if (query.status) {
      base.status = query.status as OutboundOrderStatus;
    }

    return this.outbound.listForExport(principal, base, { maxRows: opts.maxRows });
  }

  async create(client: ClientPrincipal, dto: CreateOutboundOrderDto) {
    // Planning Ownership: Client creates; Admin plans. Force admin mode + no plan.
    return this.outbound.create(
      clientAuthPrincipal(client),
      { ...dto, executionMode: 'admin', executionPlan: undefined },
      { pendingClientApproval: true },
    );
  }

  /** Client edit of an outbound order's header, allowed only until the warehouse approves it. */
  async updateEditable(client: ClientPrincipal, id: string, dto: UpdateClientOutboundOrderDto) {
    const principal = clientAuthPrincipal(client);
    const updated = await withTenantRls(this.prisma, principal, async (tx) => {
      const order = await tx.outboundOrder.findFirst({
        where: { id, companyId: client.companyId },
        select: { id: true, status: true, companyId: true, omsOrder: { select: { id: true } } },
      });
      if (!order) throw new NotFoundException('Outbound order not found.');
      if (order.omsOrder) {
        throw new BadRequestException('This order belongs to an online (OMS) order. Edit it from the OMS sheet.');
      }
      assertClientMayChangeWmsOrder(order.status);
      if (dto.requiredShipDate) assertCalendarDateNotBeforeToday(dto.requiredShipDate, 'Required ship date');
      return tx.outboundOrder.update({
        where: { id },
        data: {
          destinationAddress: dto.destinationAddress,
          requiredShipDate: dto.requiredShipDate ? new Date(dto.requiredShipDate) : undefined,
          clientReference: dto.clientReference,
          notes: dto.notes,
          updatedAt: new Date(),
        },
        select: { id: true, status: true, companyId: true },
      });
    });
    await this.audit.log(
      this.audit.fromPrincipal(principal, {
        action: 'OUTBOUND_CLIENT_EDITED',
        resourceType: 'outbound_order',
        resourceId: updated.id,
        companyId: updated.companyId,
        newState: { status: updated.status },
      }),
    );
    return this.findOne(client, id);
  }

  /** Client removal of an outbound order, allowed only until the warehouse approves it. */
  async removeUnapproved(client: ClientPrincipal, id: string) {
    const principal = clientAuthPrincipal(client);
    const order = await this.outbound.findById(id, principal);
    if (order.companyId !== client.companyId) throw new NotFoundException('Outbound order not found.');
    assertClientMayChangeWmsOrder(order.status);
    await this.outbound.cancel(id, principal);
    return this.outbound.remove(id, principal);
  }

  async findByExternalReference(client: ClientPrincipal, externalReference: string) {
    return this.outbound.findByExternalReference(
      clientAuthPrincipal(client),
      client.companyId,
      externalReference,
    );
  }

  async findByOrderNumber(client: ClientPrincipal, orderNumber: string) {
    return this.outbound.findByOrderNumber(
      clientAuthPrincipal(client),
      client.companyId,
      orderNumber,
    );
  }
}
