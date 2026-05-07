import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuthPrincipal } from '../../common/auth/current-user.types';
import {
  isAdjustmentStockLocationType,
} from '../../common/constants/storage-location-types';
import { assertLocationUsableForInventoryMove } from '../../common/utils/location-operational';
import { InvalidStateException } from '../../common/errors/domain-exceptions';
import { PrismaService } from '../../common/prisma/prisma.service';
import { StockHelpers } from '../inventory/stock.helpers';
import { AddAdjustmentLineDto } from './dto/add-adjustment-line.dto';
import {
  ADJUSTMENT_REASON_PENDING,
  CreateAdjustmentDto,
} from './dto/create-adjustment.dto';
import { PatchAdjustmentDto } from './dto/patch-adjustment.dto';
import { ListAdjustmentsQueryDto } from './dto/list-adjustments-query.dto';
import { PatchAdjustmentLineDto } from './dto/patch-adjustment-line.dto';

const ADJUSTMENT_DETAIL_INCLUDE = {
  company: { select: { id: true, name: true } },
  warehouse: { select: { id: true, code: true, name: true } },
  creator: { select: { id: true, fullName: true } },
  approver: { select: { id: true, fullName: true } },
  lines: {
    include: {
      product: { select: { id: true, sku: true, name: true, barcode: true, uom: true } },
      location: {
        select: { id: true, name: true, fullPath: true, barcode: true },
      },
      lot: { select: { id: true, lotNumber: true } },
    },
    orderBy: { id: 'asc' as const },
  },
} satisfies Prisma.StockAdjustmentInclude;

@Injectable()
export class AdjustmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stock: StockHelpers,
  ) {}

  async create(user: AuthPrincipal, dto: CreateAdjustmentDto) {
    const companyId = dto.companyId ?? user.companyId;
    if (!companyId) {
      throw new BadRequestException(
        'companyId is required (no default company on current user).',
      );
    }

    const wh = await this.prisma.warehouse.findUnique({
      where: { id: dto.warehouseId },
      select: { id: true },
    });
    if (!wh) throw new NotFoundException('Warehouse not found.');

    return this.prisma.stockAdjustment.create({
      data: {
        companyId,
        warehouseId: dto.warehouseId,
        reason: dto.reason?.trim() || ADJUSTMENT_REASON_PENDING,
        createdBy: user.id,
      },
      include: ADJUSTMENT_DETAIL_INCLUDE,
    });
  }

  async patch(user: AuthPrincipal, id: string, dto: PatchAdjustmentDto) {
    const adj = await this.prisma.stockAdjustment.findUnique({ where: { id } });
    if (!adj) throw new NotFoundException('Adjustment not found.');
    if (adj.status !== 'draft') {
      throw new InvalidStateException('Only draft adjustments can be edited.');
    }
    if (user.companyId && adj.companyId !== user.companyId) {
      throw new NotFoundException('Adjustment not found.');
    }
    return this.prisma.stockAdjustment.update({
      where: { id },
      data: { reason: dto.reason.trim(), updatedAt: new Date() },
      include: ADJUSTMENT_DETAIL_INCLUDE,
    });
  }

  list(user: AuthPrincipal, query: ListAdjustmentsQueryDto) {
    const where: Prisma.StockAdjustmentWhereInput = {};
    const companyId = query.companyId ?? user.companyId ?? undefined;
    if (companyId) where.companyId = companyId;
    if (query.status) where.status = query.status;
    if (query.warehouseId) where.warehouseId = query.warehouseId;
    if (query.adjustmentId) where.id = query.adjustmentId;

    if (query.productId || query.lotId) {
      where.lines = {
        some: {
          ...(query.productId ? { productId: query.productId } : {}),
          ...(query.lotId ? { lotId: query.lotId } : {}),
        },
      };
    }

    if (query.createdFrom || query.createdTo) {
      const createdAt: Prisma.DateTimeFilter = {};
      if (query.createdFrom) createdAt.gte = new Date(`${query.createdFrom}T00:00:00.000Z`);
      if (query.createdTo) createdAt.lte = new Date(`${query.createdTo}T23:59:59.999Z`);
      where.createdAt = createdAt;
    }

    return this.prisma.$transaction([
      this.prisma.stockAdjustment.findMany({
        where,
        include: ADJUSTMENT_DETAIL_INCLUDE,
        orderBy: { createdAt: 'desc' },
        take: query.limit,
        skip: query.offset,
      }),
      this.prisma.stockAdjustment.count({ where }),
    ]).then(([items, total]) => ({
      items,
      total,
      limit: query.limit,
      offset: query.offset,
    }));
  }

  async findById(id: string) {
    const row = await this.prisma.stockAdjustment.findUnique({
      where: { id },
      include: ADJUSTMENT_DETAIL_INCLUDE,
    });
    if (!row) throw new NotFoundException('Adjustment not found.');
    return row;
  }

  async addLine(_user: AuthPrincipal, adjustmentId: string, dto: AddAdjustmentLineDto) {
    return this.prisma.$transaction(async (tx) => {
      const adj = await tx.stockAdjustment.findUnique({ where: { id: adjustmentId } });
      if (!adj) throw new NotFoundException('Adjustment not found.');
      if (adj.status !== 'draft') {
        throw new InvalidStateException('Lines can only be added while adjustment is draft.');
      }

      const product = await tx.product.findUnique({ where: { id: dto.productId } });
      if (!product || product.companyId !== adj.companyId) {
        throw new BadRequestException('Product must belong to the adjustment company.');
      }

      const location = await tx.location.findUnique({
        where: { id: dto.locationId },
        select: { id: true, warehouseId: true, type: true, status: true },
      });
      if (!location) throw new NotFoundException('Location not found.');
      assertLocationUsableForInventoryMove(location.status);
      if (location.warehouseId !== adj.warehouseId) {
        throw new BadRequestException(
          'Location must belong to the adjustment warehouse.',
        );
      }
      if (!isAdjustmentStockLocationType(location.type)) {
        throw new BadRequestException(
          'Pick a storage, fridge, quarantine, or scrap location for this adjustment.',
        );
      }

      if (product.trackingType === 'lot') {
        if (!dto.lotId) {
          throw new BadRequestException(
            'lotId is required for lot-tracked products — select an existing lot.',
          );
        }
        const lot = await tx.lot.findUnique({
          where: { id: dto.lotId },
          select: { id: true, productId: true },
        });
        if (!lot) throw new NotFoundException('Lot not found.');
        if (lot.productId !== dto.productId) {
          throw new BadRequestException('Lot does not match product.');
        }
      } else if (dto.lotId) {
        throw new BadRequestException('lotId must not be set for non-lot-tracked products.');
      }

      const before = await this.stock.readOnHandForUpdate(tx, {
        companyId: adj.companyId,
        productId: dto.productId,
        locationId: dto.locationId,
        lotId: dto.lotId ?? null,
      });

      await tx.stockAdjustmentLine.create({
        data: {
          adjustmentId,
          productId: dto.productId,
          locationId: dto.locationId,
          lotId: dto.lotId,
          quantityBefore: before,
          quantityAfter: new Prisma.Decimal(dto.quantityAfter),
        },
      });

      return tx.stockAdjustment.findUniqueOrThrow({
        where: { id: adjustmentId },
        include: ADJUSTMENT_DETAIL_INCLUDE,
      });
    });
  }

  async patchLine(adjustmentId: string, lineId: string, dto: PatchAdjustmentLineDto) {
    return this.prisma.$transaction(async (tx) => {
      const adj = await tx.stockAdjustment.findUnique({ where: { id: adjustmentId } });
      if (!adj) throw new NotFoundException('Adjustment not found.');
      if (adj.status !== 'draft') {
        throw new InvalidStateException('Lines can only be edited while adjustment is draft.');
      }

      const line = await tx.stockAdjustmentLine.findUnique({ where: { id: lineId } });
      if (!line || line.adjustmentId !== adjustmentId) {
        throw new NotFoundException('Adjustment line not found.');
      }

      const data: Prisma.StockAdjustmentLineUpdateInput = {};
      if (dto.quantityAfter !== undefined) {
        data.quantityAfter = dto.quantityAfter;
      }
      if (dto.reasonNote !== undefined) {
        data.reasonNote = dto.reasonNote;
      }

      if (Object.keys(data).length === 0) {
        return tx.stockAdjustment.findUniqueOrThrow({
          where: { id: adjustmentId },
          include: ADJUSTMENT_DETAIL_INCLUDE,
        });
      }

      await tx.stockAdjustmentLine.update({
        where: { id: lineId },
        data,
      });

      return tx.stockAdjustment.findUniqueOrThrow({
        where: { id: adjustmentId },
        include: ADJUSTMENT_DETAIL_INCLUDE,
      });
    });
  }

  async approve(user: AuthPrincipal, id: string) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const adj = await tx.stockAdjustment.findUnique({
          where: { id },
          include: { lines: true },
        });
        if (!adj) throw new NotFoundException('Adjustment not found.');
        if (adj.status !== 'draft') {
          throw new InvalidStateException(
            `Only draft adjustments can be approved (current: ${adj.status}).`,
          );
        }
        const reasonTrim = adj.reason?.trim() ?? '';
        if (!reasonTrim || reasonTrim === ADJUSTMENT_REASON_PENDING) {
          throw new BadRequestException(
            'Set an adjustment reason in the draft form before approving.',
          );
        }
        if (adj.lines.length === 0) {
          throw new BadRequestException('Cannot approve an adjustment with no lines.');
        }

        for (const line of adj.lines) {
          const actual = await this.stock.readOnHandForUpdate(tx, {
            companyId: adj.companyId,
            productId: line.productId,
            locationId: line.locationId,
            lotId: line.lotId,
          });

          await tx.stockAdjustmentLine.update({
            where: { id: line.id },
            data: { quantityBefore: actual },
          });
        }

        await tx.stockAdjustment.update({
          where: { id },
          data: {
            status: 'approved',
            approvedBy: user.id,
            approvedAt: new Date(),
          },
        });

        const lines = await tx.stockAdjustmentLine.findMany({
          where: { adjustmentId: id },
        });

        for (const line of lines) {
          const before = new Prisma.Decimal(line.quantityBefore.toString());
          const after = new Prisma.Decimal(line.quantityAfter.toString());
          const delta = after.minus(before);
          if (delta.equals(0)) continue;

          if (delta.greaterThan(0)) {
            const meta = await this.stock.upsertPositiveWithMeta(tx, {
              companyId: adj.companyId,
              productId: line.productId,
              locationId: line.locationId,
              warehouseId: adj.warehouseId,
              lotId: line.lotId,
              quantity: delta.toString(),
            });
            await tx.inventoryLedger.create({
              data: {
                companyId: adj.companyId,
                productId: line.productId,
                lotId: line.lotId,
                toLocationId: line.locationId,
                movementType: 'adjustment_positive',
                quantity: delta,
                quantityBefore: meta.before,
                quantityAfter: meta.after,
                referenceType: 'adjustment',
                referenceId: id,
                operatorId: user.id,
              },
            });
          } else {
            const take = delta.abs();
            const meta = await this.stock.decrementWithMeta(tx, {
              companyId: adj.companyId,
              productId: line.productId,
              locationId: line.locationId,
              lotId: line.lotId,
              quantity: take.toString(),
            });
            await tx.inventoryLedger.create({
              data: {
                companyId: adj.companyId,
                productId: line.productId,
                lotId: line.lotId,
                fromLocationId: line.locationId,
                movementType: 'adjustment_negative',
                quantity: take,
                quantityBefore: meta.before,
                quantityAfter: meta.after,
                referenceType: 'adjustment',
                referenceId: id,
                operatorId: user.id,
              },
            });
          }
        }

        return tx.stockAdjustment.findUniqueOrThrow({
          where: { id },
          include: ADJUSTMENT_DETAIL_INCLUDE,
        });
      });
    } catch (e) {
      if (
        e instanceof Error &&
        e.message.includes('does not match actual stock')
      ) {
        throw new ConflictException(
          'Stock no longer matches the adjustment snapshot — concurrent modification detected.',
        );
      }
      throw e;
    }
  }

  async cancel(id: string) {
    const adj = await this.prisma.stockAdjustment.findUnique({ where: { id } });
    if (!adj) throw new NotFoundException('Adjustment not found.');
    if (adj.status !== 'draft') {
      throw new InvalidStateException('Only draft adjustments can be cancelled.');
    }

    return this.prisma.stockAdjustment.update({
      where: { id },
      data: { status: 'cancelled' },
      include: ADJUSTMENT_DETAIL_INCLUDE,
    });
  }
}
