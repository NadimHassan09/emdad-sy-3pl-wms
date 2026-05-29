import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CycleCountStatus, Prisma, ProductUom } from '@prisma/client';

import { InvalidStateException } from '../../common/errors/domain-exceptions';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  parseActualQuantity,
  validateActualQuantityForProduct,
} from './cycle-count-count-validation.util';
import { computeCycleCountDiscrepancy } from './cycle-count-discrepancy.util';

type Tx = Prisma.TransactionClient;

export interface CountLineInput {
  actualQuantity: string;
  countNotes?: string;
}

@Injectable()
export class CycleCountLineMutationService {
  constructor(private readonly prisma: PrismaService) {}

  async countLine(
    tx: Tx,
    opts: {
      cycleCountId: string;
      lineId: string;
      requiredStatus: CycleCountStatus;
      userId: string;
      input: CountLineInput;
    },
  ): Promise<void> {
    const count = await tx.cycleCount.findUnique({
      where: { id: opts.cycleCountId },
      select: { id: true, status: true, warehouseId: true },
    });
    if (!count) throw new NotFoundException('Cycle count not found.');
    if (count.status !== opts.requiredStatus) {
      throw new InvalidStateException('Cycle count is not in a countable state.');
    }

    const line = await tx.cycleCountLine.findFirst({
      where: { id: opts.lineId, cycleCountId: opts.cycleCountId },
      include: {
        product: { select: { id: true, uom: true } },
        location: { select: { id: true, warehouseId: true } },
      },
    });
    if (!line) throw new NotFoundException('Cycle count line not found.');
    if (line.location.warehouseId !== count.warehouseId) {
      throw new NotFoundException('Cycle count line not found.');
    }

    const actual = parseActualQuantity(opts.input.actualQuantity);
    validateActualQuantityForProduct(line.product.uom as ProductUom, actual);

    const discrepancy = computeCycleCountDiscrepancy(line.expectedQuantity, actual);
    const now = new Date();

    const updated = await tx.cycleCountLine.updateMany({
      where: { id: opts.lineId, cycleCountId: opts.cycleCountId, status: 'pending' },
      data: {
        actualQuantity: actual,
        discrepancyQuantity: discrepancy,
        status: 'counted',
        countedBy: opts.userId,
        countedAt: now,
        countNotes: opts.input.countNotes?.trim() || null,
      },
    });
    if (updated.count === 0) {
      throw new ConflictException(
        'This location was already counted by another session. Refresh and continue.',
      );
    }
  }

  async skipLine(
    tx: Tx,
    opts: {
      cycleCountId: string;
      lineId: string;
      requiredStatus: CycleCountStatus;
      userId: string;
      countNotes?: string;
    },
  ): Promise<void> {
    const count = await tx.cycleCount.findUnique({
      where: { id: opts.cycleCountId },
      select: { status: true },
    });
    if (!count) throw new NotFoundException('Cycle count not found.');
    if (count.status !== opts.requiredStatus) {
      throw new InvalidStateException('Cycle count is not in a countable state.');
    }

    const updated = await tx.cycleCountLine.updateMany({
      where: { id: opts.lineId, cycleCountId: opts.cycleCountId, status: 'pending' },
      data: {
        status: 'skipped',
        countedBy: opts.userId,
        countedAt: new Date(),
        countNotes: opts.countNotes?.trim() || null,
      },
    });
    if (updated.count === 0) {
      throw new ConflictException(
        'This location was already processed by another session. Refresh and continue.',
      );
    }
  }
}
