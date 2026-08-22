import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
  forwardRef,
} from '@nestjs/common';
import {
  Prisma,
  ProductTrackingType,
  ReturnItemDisposition,
  ReturnLineStatus,
  ReturnOrderStatus,
} from '@prisma/client';

import { AuditLogService } from '../../common/audit/audit-log.service';
import { readCompanyIdFilterRequired } from '../../common/auth/company-read-scope';
import { AuthPrincipal } from '../../common/auth/current-user.types';
import { CompanyAccessService } from '../../common/company-access/company-access.service';
import { InvalidStateException } from '../../common/errors/domain-exceptions';
import { assertProductOrderableForOrders } from '../../common/utils/assert-product-orderable';
import {
  assertDiscreteUomPositiveIntegerQuantity,
} from '../../common/utils/discrete-uom-quantity';
import { PrismaService } from '../../common/prisma/prisma.service';
import { withTenantRls } from '../../common/prisma/tenant-rls';
import { RealtimeService } from '../realtime/realtime.service';
import { OmsReturnsService } from '../oms-returns/oms-returns.service';
import {
  returnDetailPayload,
  returnListItemPayload,
} from '../realtime/realtime-ops.payload';
import { CreateReturnOrderDto } from './dto/create-return-order.dto';
import { ListReturnOrdersQueryDto } from './dto/list-return-orders-query.dto';
import { ReceiveReturnLineDto } from './dto/receive-return-line.dto';
import { ApplyReturnDispositionDto } from './dto/apply-return-disposition.dto';
import { InspectReturnLineDto } from './dto/inspect-return-line.dto';
import { lockOutboundOrderRow } from '../outbound/outbound-confirm-lock.util';
import {
  assertUniqueReturnLineBuckets,
  buildReturnListSummary,
} from './return-line-integrity.util';
import { ReturnQuantityValidation } from './return-quantity.validation';
import { ReturnWorkflowService } from './return-workflow.service';
import {
  isReturnCompletable,
  isReturnConfirmable,
  isReturnReceivable,
  isReturnTerminal,
} from './returns.constants';

const ORDER_INCLUDE = {
  company: { select: { id: true, name: true } },
  originalOutbound: {
    select: {
      id: true,
      orderNumber: true,
      status: true,
      trackingNumber: true,
      shippedAt: true,
    },
  },
  warehouse: { select: { id: true, code: true, name: true } },
  package: { select: { id: true, packageCode: true, status: true } },
  lines: {
    orderBy: { lineNumber: 'asc' as const },
    include: {
      product: {
        select: {
          id: true,
          sku: true,
          name: true,
          barcode: true,
          status: true,
          trackingType: true,
          uom: true,
        },
      },
      lot: { select: { id: true, lotNumber: true } },
      outboundOrderLine: { select: { id: true, lineNumber: true, pickedQuantity: true } },
      package: { select: { id: true, packageCode: true } },
      targetLocation: { select: { id: true, fullPath: true, type: true } },
    },
  },
} satisfies Prisma.ReturnOrderInclude;

@Injectable()
export class ReturnsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyAccess: CompanyAccessService,
    private readonly quantityGuard: ReturnQuantityValidation,
    private readonly workflow: ReturnWorkflowService,
    private readonly audit: AuditLogService,
    private readonly realtime: RealtimeService,
    @Optional()
    @Inject(forwardRef(() => OmsReturnsService))
    private readonly omsReturns?: OmsReturnsService,
  ) {}

  async create(user: AuthPrincipal, dto: CreateReturnOrderDto) {
    const companyId = this.companyAccess.resolveWriteCompanyId(user, dto.companyId);
    assertUniqueReturnLineBuckets(dto.lines);

    if (dto.originalOutboundOrderId) {
      const outbound = await this.prisma.outboundOrder.findUnique({
        where: { id: dto.originalOutboundOrderId },
        select: { id: true, companyId: true },
      });
      if (!outbound) throw new NotFoundException('Original outbound order not found.');
      if (outbound.companyId !== companyId) {
        throw new BadRequestException(
          'Original outbound order must belong to the same company as the return.',
        );
      }
    }

    if (dto.packageId) {
      await this.assertPackageForCompany(dto.packageId, companyId);
    }
    if (dto.warehouseId) {
      await this.assertWarehouse(dto.warehouseId);
    }

    const productIds = Array.from(new Set(dto.lines.map((l) => l.productId)));
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: {
        id: true,
        companyId: true,
        sku: true,
        status: true,
        trackingType: true,
        uom: true,
      },
    });
    if (products.length !== productIds.length) {
      throw new NotFoundException('One or more products not found.');
    }
    const wrongCompany = products.find((p) => p.companyId !== companyId);
    if (wrongCompany) {
      throw new BadRequestException(
        'All line products must belong to the same company as the return order.',
      );
    }
    for (const p of products) {
      assertProductOrderableForOrders(p.status);
    }

    const productById = new Map(products.map((p) => [p.id, p]));
    const lineCreates: Prisma.ReturnOrderLineCreateWithoutReturnOrderInput[] = [];
    const resolvedLots: Array<string | null> = [];

    for (let idx = 0; idx < dto.lines.length; idx++) {
      const l = dto.lines[idx];
      const p = productById.get(l.productId)!;
      assertDiscreteUomPositiveIntegerQuantity(p.uom, l.expectedQuantity, 'Expected quantity');

      let lotId = l.lotId ?? null;
      if (p.trackingType === ProductTrackingType.lot && !lotId) {
        lotId = await this.resolveLotFromOutbound({
          productId: l.productId,
          outboundOrderLineId: l.outboundOrderLineId,
          originalOutboundOrderId: dto.originalOutboundOrderId,
        });
      }
      if (p.trackingType === ProductTrackingType.lot && !lotId) {
        throw new BadRequestException(
          `Product ${p.sku} requires a lot on return lines.`,
        );
      }
      if (lotId) {
        await this.assertLotForProduct(lotId, l.productId, companyId);
      }
      if (l.packageId) {
        await this.assertLinePackage(l.packageId, l.productId, companyId);
      }
      if (l.outboundOrderLineId && !dto.originalOutboundOrderId) {
        throw new BadRequestException(
          'outboundOrderLineId requires originalOutboundOrderId on the return header.',
        );
      }

      resolvedLots.push(lotId);
      lineCreates.push({
        product: { connect: { id: l.productId } },
        expectedQuantity: new Prisma.Decimal(l.expectedQuantity),
        lineNumber: idx + 1,
        ...(l.outboundOrderLineId
          ? { outboundOrderLine: { connect: { id: l.outboundOrderLineId } } }
          : {}),
        ...(l.packageId ? { package: { connect: { id: l.packageId } } } : {}),
        ...(lotId ? { lot: { connect: { id: lotId } } } : {}),
        ...(l.condition ? { condition: l.condition } : {}),
        ...(l.disposition ? { disposition: l.disposition } : {}),
      });
    }

    if (dto.originalOutboundOrderId) {
      await this.quantityGuard.assertWithinShippedLimits(
        dto.originalOutboundOrderId,
        dto.lines.map((l, idx) => ({
          productId: l.productId,
          lotId: resolvedLots[idx],
          outboundOrderLineId: l.outboundOrderLineId ?? null,
          expectedQuantity: new Prisma.Decimal(l.expectedQuantity),
        })),
      );
    }

    const order = await this.prisma.returnOrder.create({
      data: {
        companyId,
        warehouseId: dto.warehouseId ?? null,
        originalOutboundOrderId: dto.originalOutboundOrderId ?? null,
        packageId: dto.packageId ?? null,
        shipmentReference: dto.shipmentReference?.trim() || null,
        clientReference: dto.clientReference?.trim() || null,
        notes: dto.notes?.trim() || null,
        createdBy: user.id,
        lines: { create: lineCreates },
      },
      include: ORDER_INCLUDE,
    });

    await this.audit.log(
      this.audit.fromPrincipal(user, {
        companyId,
        action: 'RETURN_CREATED',
        resourceType: 'return_order',
        resourceId: order.id,
        newState: { orderNumber: order.orderNumber, lineCount: order.lines.length },
      }),
    );

    this.emitReturnEvent(order, 'created');
    return order;
  }

  async list(user: AuthPrincipal, query: ListReturnOrdersQueryDto) {
    const where: Prisma.ReturnOrderWhereInput = {};
    const companyId = readCompanyIdFilterRequired(this.companyAccess, user, query.companyId);
    if (companyId) {
      where.companyId = companyId;
    }

    if (query.status) where.status = query.status;
    if (query.originalOutboundOrderId) {
      where.originalOutboundOrderId = query.originalOutboundOrderId;
    }

    const andParts: Prisma.ReturnOrderWhereInput[] = [];
    if (query.orderSearch?.trim()) {
      const t = query.orderSearch.trim();
      const orParts: Prisma.ReturnOrderWhereInput[] = [
        { orderNumber: { contains: t, mode: 'insensitive' } },
        { clientReference: { contains: t, mode: 'insensitive' } },
        { shipmentReference: { contains: t, mode: 'insensitive' } },
      ];
      if (ListReturnOrdersQueryDto.fullUuidPattern.test(t)) orParts.push({ id: t });
      andParts.push({ OR: orParts });
    }
    if (query.createdFrom || query.createdTo) {
      const createdAt: Prisma.DateTimeFilter = {};
      if (query.createdFrom) createdAt.gte = new Date(`${query.createdFrom}T00:00:00.000Z`);
      if (query.createdTo) createdAt.lte = new Date(`${query.createdTo}T23:59:59.999Z`);
      where.createdAt = createdAt;
    }
    if (query.source === 'oms') {
      andParts.push({
        OR: [
          { clientReference: { startsWith: 'oms:' } },
          { originalOutbound: { is: { omsOrder: { isNot: null } } } },
        ],
      });
    } else if (query.source === 'outbound') {
      andParts.push({
        AND: [
          {
            OR: [
              { clientReference: null },
              { NOT: { clientReference: { startsWith: 'oms:' } } },
            ],
          },
          {
            OR: [
              { originalOutboundOrderId: null },
              { originalOutbound: { is: { omsOrder: null } } },
            ],
          },
        ],
      });
    }
    if (andParts.length > 0) where.AND = andParts;

    return withTenantRls(this.prisma, user, async (tx) => {
      const [rows, total] = await Promise.all([
        tx.returnOrder.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          include: {
            company: { select: { id: true, name: true } },
            originalOutbound: { select: { id: true, orderNumber: true, status: true } },
            _count: { select: { lines: true } },
            lines: {
              select: {
                expectedQuantity: true,
                receivedQuantity: true,
                disposition: true,
                product: { select: { sku: true } },
              },
            },
          },
          take: query.limit,
          skip: query.offset,
        }),
        tx.returnOrder.count({ where }),
      ]);
      return {
        items: rows.map(({ lines, ...order }) => ({
          ...order,
          summary: buildReturnListSummary(lines),
        })),
        total,
        limit: query.limit,
        offset: query.offset,
      };
    });
  }

  async getOutboundReturnQuota(
    user: AuthPrincipal,
    outboundOrderId: string,
    excludeReturnOrderId?: string,
  ) {
    const outbound = await this.prisma.outboundOrder.findUnique({
      where: { id: outboundOrderId },
      select: { id: true, companyId: true },
    });
    if (!outbound) throw new NotFoundException('Outbound order not found.');
    this.companyAccess.validateResourceOwnership(user, outbound);
    return this.quantityGuard.getOutboundReturnQuota(outboundOrderId, excludeReturnOrderId);
  }

  async findById(id: string, user: AuthPrincipal) {
    const order = await this.prisma.returnOrder.findUnique({
      where: { id },
      include: ORDER_INCLUDE,
    });
    if (!order) throw new NotFoundException('Return order not found.');
    this.companyAccess.validateResourceOwnership(user, order);
    return order;
  }

  async confirm(user: AuthPrincipal, id: string) {
    const order = await this.findById(id, user);
    if (!isReturnConfirmable(order.status)) {
      throw new InvalidStateException(
        `Only draft return orders can be confirmed (current status: ${order.status}).`,
      );
    }
    if (order.lines.length === 0) {
      throw new BadRequestException('Add at least one line before confirming this return.');
    }
    for (const line of order.lines) {
      assertProductOrderableForOrders(line.product.status);
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      if (order.originalOutboundOrderId) {
        await lockOutboundOrderRow(tx, order.originalOutboundOrderId);
        await this.quantityGuard.assertWithinShippedLimits(
          order.originalOutboundOrderId,
          order.lines.map((l) => ({
            productId: l.productId,
            lotId: l.lotId,
            outboundOrderLineId: l.outboundOrderLineId,
            expectedQuantity: l.expectedQuantity,
          })),
          id,
          tx,
        );
      }

      return tx.returnOrder.update({
        where: { id },
        data: { status: ReturnOrderStatus.confirmed, confirmedAt: new Date() },
        include: ORDER_INCLUDE,
      });
    });

    await this.audit.log(
      this.audit.fromPrincipal(user, {
        companyId: order.companyId,
        action: 'RETURN_CONFIRMED',
        resourceType: 'return_order',
        resourceId: id,
      }),
    );

    this.emitReturnEvent(updated, 'confirmed');
    return updated;
  }

  async startReceiving(user: AuthPrincipal, id: string) {
    const order = await this.findById(id, user);
    if (order.status !== ReturnOrderStatus.confirmed) {
      throw new InvalidStateException(
        `Only confirmed return orders can start receiving (current status: ${order.status}).`,
      );
    }
    return this.prisma.returnOrder.update({
      where: { id },
      data: {
        status: ReturnOrderStatus.receiving,
        receivingStartedAt: new Date(),
      },
      include: ORDER_INCLUDE,
    }).then((updated) => {
      this.emitReturnEvent(updated, 'updated');
      return updated;
    });
  }

  async receiveLine(
    user: AuthPrincipal,
    returnOrderId: string,
    lineId: string,
    dto: ReceiveReturnLineDto,
  ) {
    const order = await this.findById(returnOrderId, user);
    if (!isReturnReceivable(order.status)) {
      throw new InvalidStateException(
        `Return order is not open for receiving (current status: ${order.status}).`,
      );
    }

    const line = order.lines.find((l) => l.id === lineId);
    if (!line) throw new NotFoundException('Return line not found.');

    const increment = new Prisma.Decimal(dto.quantity);
    const nextReceived = line.receivedQuantity.add(increment);
    if (nextReceived.gt(line.expectedQuantity)) {
      throw new BadRequestException(
        `Received quantity cannot exceed expected (${line.expectedQuantity.toString()}).`,
      );
    }

    const lineStatus =
      nextReceived.gt(0) ? ReturnLineStatus.received : ReturnLineStatus.pending;

    const data: Prisma.ReturnOrderLineUpdateInput = {
      receivedQuantity: nextReceived,
      lineStatus,
      ...(dto.condition !== undefined ? { condition: dto.condition } : {}),
    };

    const result = await this.prisma.$transaction(async (tx) => {
      await this.workflow.syncOrderWorkflowStatus(tx, returnOrderId, { receiving: true });
      await tx.returnOrderLine.update({ where: { id: lineId }, data });
      return tx.returnOrder.findUniqueOrThrow({
        where: { id: returnOrderId },
        include: ORDER_INCLUDE,
      });
    });

    await this.audit.log(
      this.audit.fromPrincipal(user, {
        companyId: order.companyId,
        action: 'RETURN_LINE_RECEIVED',
        resourceType: 'return_order_line',
        resourceId: lineId,
        newState: {
          returnOrderId,
          receivedQuantity: nextReceived.toString(),
        },
      }),
    );

    this.emitReturnEvent(result, 'updated');
    return result;
  }

  inspectLine(
    user: AuthPrincipal,
    returnOrderId: string,
    lineId: string,
    dto: InspectReturnLineDto,
  ) {
    return this.workflow.inspectLine(user, returnOrderId, lineId, dto);
  }

  applyDisposition(
    user: AuthPrincipal,
    returnOrderId: string,
    lineId: string,
    dto: ApplyReturnDispositionDto,
  ) {
    return this.workflow.applyDisposition(user, returnOrderId, lineId, dto);
  }

  postAllInventory(user: AuthPrincipal, returnOrderId: string) {
    return this.workflow.postAllEligibleLines(user, returnOrderId);
  }

  async complete(user: AuthPrincipal, id: string) {
    const order = await this.findById(id, user);
    if (!isReturnCompletable(order.status)) {
      throw new InvalidStateException(
        `Only receiving return orders can be completed (current status: ${order.status}).`,
      );
    }
    const incomplete = order.lines.find((l) => l.receivedQuantity.lt(l.expectedQuantity));
    if (incomplete) {
      throw new BadRequestException(
        'All lines must be fully received before completing the return order.',
      );
    }
    this.workflow.assertAllLinesPosted(order.lines);

    const updated = await this.prisma.returnOrder.update({
      where: { id },
      data: { status: ReturnOrderStatus.completed, completedAt: new Date() },
      include: ORDER_INCLUDE,
    });

    await this.audit.log(
      this.audit.fromPrincipal(user, {
        companyId: order.companyId,
        action: 'RETURN_COMPLETED',
        resourceType: 'return_order',
        resourceId: id,
      }),
    );

    this.emitReturnEvent(updated, 'completed');
    try {
      await this.omsReturns?.onWarehouseReturnCompleted(user, id);
    } catch {
      // COD adjustment failure must not roll back warehouse completion.
    }
    return updated;
  }

  /**
   * Drive an OMS-linked warehouse return from draft through restock + complete.
   * Used when commercial OMS return approval should immediately restock and
   * trigger the COD adjustment (via complete → onWarehouseReturnCompleted).
   */
  async finalizeAfterOmsApproval(user: AuthPrincipal, returnOrderId: string) {
    let order = await this.findById(returnOrderId, user);
    if (order.status === ReturnOrderStatus.completed) {
      return order;
    }
    if (order.status === ReturnOrderStatus.cancelled) {
      throw new InvalidStateException('Cannot finalize a cancelled return order.');
    }

    if (!order.warehouseId) {
      const warehouseId = await this.resolveWarehouseIdFromOutbound(
        order.originalOutboundOrderId,
      );
      if (!warehouseId) {
        throw new BadRequestException(
          'Cannot resolve warehouse for return restock. Provide warehouseId on approve.',
        );
      }
      order = await this.prisma.returnOrder.update({
        where: { id: returnOrderId },
        data: { warehouseId },
        include: ORDER_INCLUDE,
      });
    }

    if (order.status === ReturnOrderStatus.draft) {
      order = await this.confirm(user, returnOrderId);
    }
    if (order.status === ReturnOrderStatus.confirmed) {
      order = await this.startReceiving(user, returnOrderId);
    }

    order = await this.findById(returnOrderId, user);
    for (const line of order.lines) {
      const remaining = line.expectedQuantity.minus(line.receivedQuantity);
      if (remaining.gt(0)) {
        await this.receiveLine(user, returnOrderId, line.id, {
          quantity: Number(remaining),
        });
      }
    }

    order = await this.findById(returnOrderId, user);
    for (const line of order.lines) {
      if (line.lineStatus === ReturnLineStatus.posted) continue;
      if (line.receivedQuantity.lte(0)) continue;
      const targetLocationId = await this.resolveRestockLocationId({
        warehouseId: order.warehouseId!,
        productId: line.productId,
        lotId: line.lotId,
        outboundOrderId: order.originalOutboundOrderId,
      });
      await this.applyDisposition(user, returnOrderId, line.id, {
        disposition: ReturnItemDisposition.restock,
        targetLocationId,
      });
    }

    return this.complete(user, returnOrderId);
  }

  private async resolveWarehouseIdFromOutbound(
    outboundOrderId: string | null | undefined,
  ): Promise<string | null> {
    if (!outboundOrderId) return null;
    const reservation = await this.prisma.stockReservation.findFirst({
      where: { outboundOrderId },
      orderBy: { createdAt: 'desc' },
      select: { location: { select: { warehouseId: true } } },
    });
    return reservation?.location.warehouseId ?? null;
  }

  private async resolveRestockLocationId(params: {
    warehouseId: string;
    productId: string;
    lotId: string | null;
    outboundOrderId: string | null;
  }): Promise<string> {
    if (params.outboundOrderId) {
      const fromOutbound = await this.prisma.stockReservation.findFirst({
        where: {
          outboundOrderId: params.outboundOrderId,
          productId: params.productId,
          ...(params.lotId ? { lotId: params.lotId } : {}),
          location: {
            warehouseId: params.warehouseId,
            type: { in: ['internal', 'fridge'] },
            status: 'active',
          },
        },
        orderBy: { createdAt: 'desc' },
        select: { locationId: true },
      });
      if (fromOutbound?.locationId) return fromOutbound.locationId;
    }

    const sellable = await this.prisma.location.findFirst({
      where: {
        warehouseId: params.warehouseId,
        type: { in: ['internal', 'fridge'] },
        status: 'active',
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (!sellable) {
      throw new BadRequestException(
        'No sellable location available to restock returned inventory.',
      );
    }
    return sellable.id;
  }

  async cancel(user: AuthPrincipal, id: string) {
    const order = await this.findById(id, user);
    if (isReturnTerminal(order.status)) {
      throw new InvalidStateException(
        `Return order cannot be cancelled (current status: ${order.status}).`,
      );
    }
    if (order.lines.some((l) => l.receivedQuantity.gt(0))) {
      throw new BadRequestException(
        'Cannot cancel a return order after quantity has been received on a line.',
      );
    }

    const updated = await this.prisma.returnOrder.update({
      where: { id },
      data: {
        status: ReturnOrderStatus.cancelled,
        cancelledAt: new Date(),
        cancelledBy: user.id,
      },
      include: ORDER_INCLUDE,
    });

    await this.audit.log(
      this.audit.fromPrincipal(user, {
        companyId: order.companyId,
        action: 'RETURN_CANCELLED',
        resourceType: 'return_order',
        resourceId: id,
      }),
    );

    this.emitReturnEvent(updated, 'updated');
    return updated;
  }

  private emitReturnEvent(
    order: Prisma.ReturnOrderGetPayload<{ include: typeof ORDER_INCLUDE }>,
    kind: 'created' | 'updated' | 'confirmed' | 'completed',
  ): void {
    const listItem = returnListItemPayload(order);
    const detail = returnDetailPayload(order as unknown as Record<string, unknown>);
    const payload = { listItem, return: detail };
    switch (kind) {
      case 'created':
        this.realtime.emitReturnCreated(order.companyId, payload);
        break;
      case 'updated':
        this.realtime.emitReturnUpdated(order.companyId, payload);
        break;
      case 'confirmed':
        this.realtime.emitReturnConfirmed(order.companyId, payload);
        break;
      case 'completed':
        this.realtime.emitReturnCompleted(order.companyId, payload);
        break;
    }
  }

  private async assertWarehouse(warehouseId: string) {
    const wh = await this.prisma.warehouse.findUnique({
      where: { id: warehouseId },
      select: { id: true, status: true },
    });
    if (!wh || wh.status !== 'active') {
      throw new NotFoundException('Warehouse not found.');
    }
  }

  private async assertPackageForCompany(packageId: string, companyId: string) {
    const pkg = await this.prisma.package.findUnique({
      where: { id: packageId },
      include: { product: { select: { companyId: true } } },
    });
    if (!pkg) throw new NotFoundException('Package not found.');
    if (pkg.product.companyId !== companyId) {
      throw new NotFoundException('Package not found.');
    }
  }

  private async assertLinePackage(
    packageId: string,
    productId: string,
    companyId: string,
  ) {
    const pkg = await this.prisma.package.findUnique({
      where: { id: packageId },
      include: { product: { select: { id: true, companyId: true } } },
    });
    if (!pkg || pkg.product.companyId !== companyId) {
      throw new NotFoundException('Package not found.');
    }
    if (pkg.productId !== productId) {
      throw new BadRequestException('Package product does not match the return line product.');
    }
  }

  private async assertLotForProduct(
    lotId: string,
    productId: string,
    companyId: string,
  ) {
    const lot = await this.prisma.lot.findUnique({
      where: { id: lotId },
      include: { product: { select: { id: true, companyId: true } } },
    });
    if (!lot || lot.product.companyId !== companyId) {
      throw new NotFoundException('Lot not found.');
    }
    if (lot.productId !== productId) {
      throw new BadRequestException('Lot does not belong to the return line product.');
    }
  }

  /**
   * Client returns often omit lotId. Resolve from the outbound line's specific lot
   * or from stock reservations used when the order was fulfilled.
   */
  private async resolveLotFromOutbound(params: {
    productId: string;
    outboundOrderLineId?: string;
    originalOutboundOrderId?: string;
  }): Promise<string | null> {
    if (params.outboundOrderLineId) {
      const line = await this.prisma.outboundOrderLine.findUnique({
        where: { id: params.outboundOrderLineId },
        select: {
          specificLotId: true,
          outboundOrderId: true,
          productId: true,
        },
      });
      if (line?.specificLotId) return line.specificLotId;

      if (line) {
        const byLine = await this.prisma.stockReservation.findFirst({
          where: {
            outboundOrderLineId: params.outboundOrderLineId,
            productId: params.productId,
            lotId: { not: null },
          },
          orderBy: { createdAt: 'desc' },
          select: { lotId: true },
        });
        if (byLine?.lotId) return byLine.lotId;

        const byOrder = await this.prisma.stockReservation.findFirst({
          where: {
            outboundOrderId: line.outboundOrderId,
            productId: params.productId,
            lotId: { not: null },
          },
          orderBy: { createdAt: 'desc' },
          select: { lotId: true },
        });
        if (byOrder?.lotId) return byOrder.lotId;
      }
    }

    if (params.originalOutboundOrderId) {
      const byOrder = await this.prisma.stockReservation.findFirst({
        where: {
          outboundOrderId: params.originalOutboundOrderId,
          productId: params.productId,
          lotId: { not: null },
        },
        orderBy: { createdAt: 'desc' },
        select: { lotId: true },
      });
      if (byOrder?.lotId) return byOrder.lotId;
    }

    return null;
  }
}
