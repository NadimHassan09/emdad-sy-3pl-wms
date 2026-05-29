import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  ProductTrackingType,
  ReturnOrderStatus,
} from '@prisma/client';

import { readCompanyIdFilterRequired } from '../../common/auth/company-read-scope';
import { AuthPrincipal } from '../../common/auth/current-user.types';
import { CompanyAccessService } from '../../common/company-access/company-access.service';
import { InvalidStateException } from '../../common/errors/domain-exceptions';
import { assertProductOrderableForOrders } from '../../common/utils/assert-product-orderable';
import {
  assertDiscreteUomPositiveIntegerQuantity,
} from '../../common/utils/discrete-uom-quantity';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateReturnOrderDto } from './dto/create-return-order.dto';
import { ListReturnOrdersQueryDto } from './dto/list-return-orders-query.dto';
import { ReceiveReturnLineDto } from './dto/receive-return-line.dto';
import { ReturnQuantityValidation } from './return-quantity.validation';
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
    },
  },
} satisfies Prisma.ReturnOrderInclude;

@Injectable()
export class ReturnsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyAccess: CompanyAccessService,
    private readonly quantityGuard: ReturnQuantityValidation,
  ) {}

  async create(user: AuthPrincipal, dto: CreateReturnOrderDto) {
    const companyId = this.companyAccess.resolveWriteCompanyId(user, dto.companyId);

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

    for (let idx = 0; idx < dto.lines.length; idx++) {
      const l = dto.lines[idx];
      const p = productById.get(l.productId)!;
      assertDiscreteUomPositiveIntegerQuantity(p.uom, l.expectedQuantity, 'Expected quantity');

      if (p.trackingType === ProductTrackingType.lot && !l.lotId) {
        throw new BadRequestException(
          `Product ${p.sku} requires a lot on return lines.`,
        );
      }
      if (l.lotId) {
        await this.assertLotForProduct(l.lotId, l.productId, companyId);
      }
      if (l.packageId) {
        await this.assertLinePackage(l.packageId, l.productId, companyId);
      }
      if (l.outboundOrderLineId && !dto.originalOutboundOrderId) {
        throw new BadRequestException(
          'outboundOrderLineId requires originalOutboundOrderId on the return header.',
        );
      }

      lineCreates.push({
        product: { connect: { id: l.productId } },
        expectedQuantity: new Prisma.Decimal(l.expectedQuantity),
        lineNumber: idx + 1,
        ...(l.outboundOrderLineId
          ? { outboundOrderLine: { connect: { id: l.outboundOrderLineId } } }
          : {}),
        ...(l.packageId ? { package: { connect: { id: l.packageId } } } : {}),
        ...(l.lotId ? { lot: { connect: { id: l.lotId } } } : {}),
        ...(l.condition ? { condition: l.condition } : {}),
        ...(l.disposition ? { disposition: l.disposition } : {}),
      });
    }

    if (dto.originalOutboundOrderId) {
      await this.quantityGuard.assertWithinShippedLimits(
        dto.originalOutboundOrderId,
        dto.lines.map((l) => ({
          productId: l.productId,
          lotId: l.lotId ?? null,
          outboundOrderLineId: l.outboundOrderLineId ?? null,
          expectedQuantity: new Prisma.Decimal(l.expectedQuantity),
        })),
      );
    }

    return this.prisma.returnOrder.create({
      data: {
        companyId,
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
  }

  async list(user: AuthPrincipal, query: ListReturnOrdersQueryDto) {
    const where: Prisma.ReturnOrderWhereInput = {};
    const companyId = readCompanyIdFilterRequired(this.companyAccess, user, query.companyId);
    where.companyId = companyId;

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
    if (andParts.length > 0) where.AND = andParts;

    return this.prisma.$transaction([
      this.prisma.returnOrder.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          company: { select: { id: true, name: true } },
          originalOutbound: { select: { id: true, orderNumber: true, status: true } },
          _count: { select: { lines: true } },
        },
        take: query.limit,
        skip: query.offset,
      }),
      this.prisma.returnOrder.count({ where }),
    ]).then(([items, total]) => ({ items, total, limit: query.limit, offset: query.offset }));
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
    if (order.originalOutboundOrderId) {
      await this.quantityGuard.assertWithinShippedLimits(
        order.originalOutboundOrderId,
        order.lines.map((l) => ({
          productId: l.productId,
          lotId: l.lotId,
          outboundOrderLineId: l.outboundOrderLineId,
          expectedQuantity: l.expectedQuantity,
        })),
        id,
      );
    }

    return this.prisma.returnOrder.update({
      where: { id },
      data: { status: ReturnOrderStatus.confirmed, confirmedAt: new Date() },
      include: ORDER_INCLUDE,
    });
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

    const now = new Date();
    const data: Prisma.ReturnOrderLineUpdateInput = {
      receivedQuantity: nextReceived,
      ...(dto.condition !== undefined ? { condition: dto.condition } : {}),
      ...(dto.disposition !== undefined ? { disposition: dto.disposition } : {}),
    };

    return this.prisma.$transaction(async (tx) => {
      if (order.status === ReturnOrderStatus.confirmed) {
        await tx.returnOrder.update({
          where: { id: returnOrderId },
          data: {
            status: ReturnOrderStatus.receiving,
            receivingStartedAt: order.receivingStartedAt ?? now,
          },
        });
      }
      await tx.returnOrderLine.update({ where: { id: lineId }, data });
      return tx.returnOrder.findUniqueOrThrow({
        where: { id: returnOrderId },
        include: ORDER_INCLUDE,
      });
    });
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
    const missingDisposition = order.lines.find((l) => !l.disposition);
    if (missingDisposition) {
      throw new BadRequestException(
        'Each line must have a disposition before completing the return.',
      );
    }

    return this.prisma.returnOrder.update({
      where: { id },
      data: { status: ReturnOrderStatus.completed, completedAt: new Date() },
      include: ORDER_INCLUDE,
    });
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

    return this.prisma.returnOrder.update({
      where: { id },
      data: {
        status: ReturnOrderStatus.cancelled,
        cancelledAt: new Date(),
        cancelledBy: user.id,
      },
      include: ORDER_INCLUDE,
    });
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
}
