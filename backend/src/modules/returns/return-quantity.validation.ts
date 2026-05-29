import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { OutboundOrderStatus, Prisma } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import { RETURN_ACTIVE_FOR_QUOTA } from './returns.constants';

export type ReturnLineQuantityInput = {
  productId: string;
  lotId?: string | null;
  outboundOrderLineId?: string | null;
  expectedQuantity: Prisma.Decimal;
};

@Injectable()
export class ReturnQuantityValidation {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Ensures cumulative return quantities do not exceed quantities shipped on the
   * linked outbound order (picked_quantity per outbound line).
   */
  async assertWithinShippedLimits(
    originalOutboundOrderId: string,
    lines: ReturnLineQuantityInput[],
    excludeReturnOrderId?: string,
  ): Promise<void> {
    const outbound = await this.prisma.outboundOrder.findUnique({
      where: { id: originalOutboundOrderId },
      include: {
        lines: {
          select: {
            id: true,
            productId: true,
            specificLotId: true,
            pickedQuantity: true,
          },
        },
      },
    });
    if (!outbound) {
      throw new NotFoundException('Original outbound order not found.');
    }
    if (outbound.status !== OutboundOrderStatus.shipped) {
      throw new BadRequestException(
        'Returns linked to an outbound order require that order to be in shipped status.',
      );
    }

    const outboundLineById = new Map(outbound.lines.map((l) => [l.id, l]));
    const buckets = new Map<string, { max: Prisma.Decimal; add: Prisma.Decimal }>();

    for (const line of lines) {
      if (line.expectedQuantity.lte(0)) {
        throw new BadRequestException('Return line expected quantity must be positive.');
      }

      let max: Prisma.Decimal;
      let bucketKey: string;

      if (line.outboundOrderLineId) {
        const obLine = outboundLineById.get(line.outboundOrderLineId);
        if (!obLine) {
          throw new BadRequestException(
            'outboundOrderLineId does not belong to the linked outbound order.',
          );
        }
        if (obLine.productId !== line.productId) {
          throw new BadRequestException(
            'Return line product does not match the referenced outbound line.',
          );
        }
        if (line.lotId && obLine.specificLotId && obLine.specificLotId !== line.lotId) {
          throw new BadRequestException(
            'Return line lot does not match the referenced outbound line lot.',
          );
        }
        max = obLine.pickedQuantity;
        bucketKey = `line:${line.outboundOrderLineId}`;
      } else {
        const matching = outbound.lines.filter((l) => {
          if (l.productId !== line.productId) return false;
          if (line.lotId && l.specificLotId && l.specificLotId !== line.lotId) return false;
          return true;
        });
        if (matching.length === 0) {
          throw new BadRequestException(
            'No matching outbound line found for return product/lot on the linked order.',
          );
        }
        max = matching.reduce((sum, l) => sum.add(l.pickedQuantity), new Prisma.Decimal(0));
        const lotPart = line.lotId ?? 'any';
        bucketKey = `product:${line.productId}:lot:${lotPart}`;
      }

      const cur = buckets.get(bucketKey) ?? { max, add: new Prisma.Decimal(0) };
      cur.add = cur.add.add(line.expectedQuantity);
      buckets.set(bucketKey, cur);
    }

    for (const [key, { max, add }] of buckets) {
      const alreadyReturned = await this.sumActiveReturnQuantity(
        originalOutboundOrderId,
        key,
        excludeReturnOrderId,
      );
      const total = alreadyReturned.add(add);
      if (total.gt(max)) {
        throw new BadRequestException(
          `Return quantity exceeds shipped quantity for ${key.replace(/^line:|^product:/, '')} ` +
            `(shipped ${max.toString()}, already returned ${alreadyReturned.toString()}, requested ${add.toString()}).`,
        );
      }
    }
  }

  private async sumActiveReturnQuantity(
    outboundOrderId: string,
    bucketKey: string,
    excludeReturnOrderId?: string,
  ): Promise<Prisma.Decimal> {
    const isLineBucket = bucketKey.startsWith('line:');
    const outboundOrderLineId = isLineBucket ? bucketKey.slice(5) : undefined;
    const productId = !isLineBucket
      ? bucketKey.split(':')[1]
      : undefined;
    const lotId = !isLineBucket && bucketKey.includes(':lot:')
      ? bucketKey.split(':lot:')[1]
      : undefined;
    const rows = await this.prisma.returnOrderLine.findMany({
      where: {
        returnOrder: {
          originalOutboundOrderId: outboundOrderId,
          status: { in: RETURN_ACTIVE_FOR_QUOTA },
          ...(excludeReturnOrderId ? { id: { not: excludeReturnOrderId } } : {}),
        },
        ...(outboundOrderLineId ? { outboundOrderLineId } : {}),
        ...(productId
          ? {
              productId,
              ...(lotId && lotId !== 'any' ? { lotId } : {}),
            }
          : {}),
      },
      select: { expectedQuantity: true },
    });

    return rows.reduce((sum, r) => sum.add(r.expectedQuantity), new Prisma.Decimal(0));
  }
}
