import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  Prisma,
  ReturnItemDisposition,
  ReturnLineStatus,
  ReturnOrderStatus,
} from '@prisma/client';

import { AuditLogService } from '../../common/audit/audit-log.service';
import { AuthPrincipal } from '../../common/auth/current-user.types';
import { CompanyAccessService } from '../../common/company-access/company-access.service';
import { InvalidStateException } from '../../common/errors/domain-exceptions';
import { PrismaService } from '../../common/prisma/prisma.service';
import { InspectReturnLineDto } from './dto/inspect-return-line.dto';
import { ApplyReturnDispositionDto } from './dto/apply-return-disposition.dto';
import {
  isInventoryPostingDisposition,
  isPendingInspectionDisposition,
  normalizeReturnDisposition,
} from './return-disposition.policy';
import { ReturnInventoryService } from './return-inventory.service';
import {
  isReturnInspectable,
  isReturnInventoryApplicable,
} from './returns.constants';

const ORDER_INCLUDE = {
  company: { select: { id: true, name: true } },
  warehouse: { select: { id: true, code: true, name: true } },
  originalOutbound: {
    select: { id: true, orderNumber: true, status: true },
  },
  lines: {
    orderBy: { lineNumber: 'asc' as const },
    include: {
      product: { select: { id: true, sku: true, name: true, uom: true } },
      lot: { select: { id: true, lotNumber: true } },
      targetLocation: { select: { id: true, fullPath: true, type: true } },
    },
  },
} satisfies Prisma.ReturnOrderInclude;

@Injectable()
export class ReturnWorkflowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyAccess: CompanyAccessService,
    private readonly inventory: ReturnInventoryService,
    private readonly audit: AuditLogService,
  ) {}

  async inspectLine(
    user: AuthPrincipal,
    returnOrderId: string,
    lineId: string,
    dto: InspectReturnLineDto,
  ) {
    const order = await this.loadOrder(returnOrderId, user);
    if (!isReturnInspectable(order.status)) {
      throw new InvalidStateException(
        `Return is not open for inspection (status: ${order.status}).`,
      );
    }

    const line = order.lines.find((l) => l.id === lineId);
    if (!line) throw new NotFoundException('Return line not found.');
    if (line.receivedQuantity.lte(0)) {
      throw new BadRequestException('Inspect after at least some quantity has been received.');
    }
    if (line.lineStatus === ReturnLineStatus.posted) {
      throw new InvalidStateException('Posted lines cannot be re-inspected.');
    }

    const disposition = dto.disposition
      ? normalizeReturnDisposition(dto.disposition)
      : line.disposition;

    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      await tx.returnOrderLine.update({
        where: { id: lineId },
        data: {
          condition: dto.condition ?? line.condition,
          disposition,
          inspectionNotes: dto.inspectionNotes?.trim() || line.inspectionNotes,
          inspectedAt: now,
          inspectedBy: user.id,
          lineStatus: ReturnLineStatus.inspected,
          ...(dto.targetLocationId !== undefined
            ? { targetLocationId: dto.targetLocationId || null }
            : {}),
        },
      });

      await this.syncOrderWorkflowStatus(tx, returnOrderId, {
        inspecting: true,
      });

      await this.audit.logTx(tx, {
        ...this.audit.fromPrincipal(user, {
          companyId: order.companyId,
          action: 'return.line.inspected',
          resourceType: 'return_order_line',
          resourceId: lineId,
          newState: {
            returnOrderId,
            condition: dto.condition,
            disposition,
            targetLocationId: dto.targetLocationId,
          },
        }),
      });

      return tx.returnOrder.findUniqueOrThrow({
        where: { id: returnOrderId },
        include: ORDER_INCLUDE,
      });
    });
  }

  async applyDisposition(
    user: AuthPrincipal,
    returnOrderId: string,
    lineId: string,
    dto: ApplyReturnDispositionDto,
  ) {
    const order = await this.loadOrder(returnOrderId, user);
    if (!isReturnInventoryApplicable(order.status)) {
      throw new InvalidStateException(
        `Return is not ready for inventory posting (status: ${order.status}).`,
      );
    }
    if (!order.warehouseId) {
      throw new BadRequestException(
        'Return order warehouseId is required before posting inventory.',
      );
    }

    const line = order.lines.find((l) => l.id === lineId);
    if (!line) throw new NotFoundException('Return line not found.');
    if (line.lineStatus === ReturnLineStatus.posted) {
      throw new InvalidStateException('Line inventory already posted.');
    }
    if (line.receivedQuantity.lte(0)) {
      throw new BadRequestException('Cannot post inventory without received quantity.');
    }

    const disposition = normalizeReturnDisposition(
      dto.disposition ?? line.disposition ?? ReturnItemDisposition.inspection_required,
    );
    if (isPendingInspectionDisposition(disposition)) {
      throw new BadRequestException(
        'Resolve inspection (set a final disposition) before posting inventory.',
      );
    }
    if (!isInventoryPostingDisposition(disposition)) {
      throw new BadRequestException('Invalid disposition for inventory posting.');
    }

    const targetLocationId = dto.targetLocationId ?? line.targetLocationId;
    if (!targetLocationId) {
      throw new BadRequestException('targetLocationId is required for this disposition.');
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.disposition || dto.targetLocationId) {
        await tx.returnOrderLine.update({
          where: { id: lineId },
          data: {
            disposition,
            targetLocationId,
            lineStatus: ReturnLineStatus.inspected,
            inspectedAt: line.inspectedAt ?? new Date(),
            inspectedBy: line.inspectedBy ?? user.id,
          },
        });
      }

      const fresh = await tx.returnOrderLine.findUniqueOrThrow({ where: { id: lineId } });

      await this.inventory.applyLineInventory(tx, {
        returnOrderId,
        companyId: order.companyId,
        warehouseId: order.warehouseId!,
        operatorId: user.id,
        line: {
          id: fresh.id,
          productId: fresh.productId,
          lotId: fresh.lotId,
          packageId: fresh.packageId,
          receivedQuantity: fresh.receivedQuantity,
          postedQuantity: fresh.postedQuantity,
          disposition: fresh.disposition!,
          targetLocationId: fresh.targetLocationId,
          lineStatus: fresh.lineStatus,
        },
      });

      await this.audit.logTx(tx, {
        ...this.audit.fromPrincipal(user, {
          companyId: order.companyId,
          action: 'return.line.inventory_posted',
          resourceType: 'return_order_line',
          resourceId: lineId,
          newState: {
            returnOrderId,
            disposition,
            targetLocationId,
            quantity: fresh.receivedQuantity.toString(),
          },
        }),
      });

      return tx.returnOrder.findUniqueOrThrow({
        where: { id: returnOrderId },
        include: ORDER_INCLUDE,
      });
    });
  }

  async postAllEligibleLines(user: AuthPrincipal, returnOrderId: string) {
    const order = await this.loadOrder(returnOrderId, user);
    if (!order.warehouseId) {
      throw new BadRequestException('warehouseId is required on the return order.');
    }

    const eligible = order.lines.filter(
      (l) =>
        l.lineStatus !== ReturnLineStatus.posted &&
        l.receivedQuantity.gt(0) &&
        l.disposition &&
        isInventoryPostingDisposition(l.disposition) &&
        l.targetLocationId,
    );
    if (eligible.length === 0) {
      throw new BadRequestException('No lines are ready for inventory posting.');
    }

    for (const line of eligible) {
      await this.applyDisposition(user, returnOrderId, line.id, {
        targetLocationId: line.targetLocationId!,
        disposition: line.disposition!,
      });
    }

    return this.loadOrder(returnOrderId, user);
  }

  private async loadOrder(returnOrderId: string, user: AuthPrincipal) {
    const order = await this.prisma.returnOrder.findUnique({
      where: { id: returnOrderId },
      include: ORDER_INCLUDE,
    });
    if (!order) throw new NotFoundException('Return order not found.');
    this.companyAccess.validateResourceOwnership(user, order);
    return order;
  }

  async syncOrderWorkflowStatus(
    tx: Prisma.TransactionClient,
    returnOrderId: string,
    opts: { receiving?: boolean; inspecting?: boolean },
  ) {
    const order = await tx.returnOrder.findUnique({
      where: { id: returnOrderId },
      select: { status: true, receivingStartedAt: true, inspectingStartedAt: true },
    });
    if (!order) return;

    const now = new Date();
    const data: Prisma.ReturnOrderUpdateInput = {};

    if (
      opts.receiving &&
      (order.status === ReturnOrderStatus.confirmed ||
        order.status === ReturnOrderStatus.receiving)
    ) {
      data.status = ReturnOrderStatus.receiving;
      if (!order.receivingStartedAt) data.receivingStartedAt = now;
    }

    if (
      opts.inspecting &&
      (order.status === ReturnOrderStatus.receiving ||
        order.status === ReturnOrderStatus.inspecting)
    ) {
      data.status = ReturnOrderStatus.inspecting;
      if (!order.inspectingStartedAt) data.inspectingStartedAt = now;
    }

    if (Object.keys(data).length > 0) {
      await tx.returnOrder.update({ where: { id: returnOrderId }, data });
    }
  }

  assertAllLinesPosted(lines: { lineStatus: ReturnLineStatus; receivedQuantity: Prisma.Decimal }[]): void {
    const notPosted = lines.filter(
      (l) => l.receivedQuantity.gt(0) && l.lineStatus !== ReturnLineStatus.posted,
    );
    if (notPosted.length > 0) {
      throw new BadRequestException(
        'All received lines must have inventory posted before completing the return.',
      );
    }
  }
}
