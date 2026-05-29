import { BadRequestException, Injectable } from '@nestjs/common';
import {
  LedgerRefType,
  MovementType,
  Prisma,
  ReturnItemDisposition,
  ReturnLineStatus,
  StockStatus,
} from '@prisma/client';

import { assertLocationUsableForInventoryMove } from '../../common/utils/location-operational';
import { PrismaService } from '../../common/prisma/prisma.service';
import { LedgerIdempotencyService } from '../inventory/ledger-idempotency.service';
import { StockHelpers } from '../inventory/stock.helpers';
import {
  assertLocationAllowedForDisposition,
  isInventoryPostingDisposition,
  normalizeReturnDisposition,
  stockStatusForDisposition,
} from './return-disposition.policy';

type Tx = Prisma.TransactionClient;

export type ReturnLineInventoryContext = {
  returnOrderId: string;
  companyId: string;
  warehouseId: string;
  operatorId: string;
    line: {
    id: string;
    productId: string;
    lotId: string | null;
    packageId: string | null;
    receivedQuantity: Prisma.Decimal;
    postedQuantity: Prisma.Decimal;
    disposition: ReturnItemDisposition;
    targetLocationId: string | null;
    lineStatus: ReturnLineStatus;
  };
};

@Injectable()
export class ReturnInventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stock: StockHelpers,
    private readonly ledger: LedgerIdempotencyService,
  ) {}

  async applyLineInventory(tx: Tx, ctx: ReturnLineInventoryContext): Promise<void> {
    const line = ctx.line;
    if (line.lineStatus === ReturnLineStatus.posted) {
      throw new BadRequestException('Return line inventory has already been posted.');
    }
    if (!isInventoryPostingDisposition(line.disposition)) {
      throw new BadRequestException(
        'Disposition does not allow inventory posting (complete inspection first).',
      );
    }
    if (!line.targetLocationId) {
      throw new BadRequestException('targetLocationId is required to post return inventory.');
    }

    const qtyToPost = line.receivedQuantity.minus(line.postedQuantity);
    if (qtyToPost.lte(0)) {
      throw new BadRequestException('No received quantity remains to post.');
    }

    const location = await tx.location.findUnique({
      where: { id: line.targetLocationId },
      select: { id: true, warehouseId: true, type: true, status: true },
    });
    if (!location || location.warehouseId !== ctx.warehouseId) {
      throw new BadRequestException('Target location not found in the return warehouse.');
    }
    assertLocationUsableForInventoryMove(location.status);
    const disposition = normalizeReturnDisposition(line.disposition);
    assertLocationAllowedForDisposition(disposition, location.type);

    const movementType = this.movementTypeForDisposition(disposition);
    const stockStatus = stockStatusForDisposition(disposition);

    const meta = await this.stock.upsertPositiveWithMeta(tx, {
      companyId: ctx.companyId,
      productId: line.productId,
      locationId: location.id,
      warehouseId: ctx.warehouseId,
      lotId: line.lotId,
      quantity: qtyToPost.toString(),
    });

    await this.setStockStatus(tx, {
      companyId: ctx.companyId,
      productId: line.productId,
      locationId: location.id,
      lotId: line.lotId,
      status: stockStatus,
    });

    const idempotencyKey = `return:${ctx.returnOrderId}:line:${line.id}:post`;
    await this.ledger.appendIfAbsent(tx, idempotencyKey, {
      companyId: ctx.companyId,
      productId: line.productId,
      lotId: line.lotId,
      toLocationId: location.id,
      movementType,
      quantity: qtyToPost,
      quantityBefore: meta.before,
      quantityAfter: meta.after,
      referenceType: LedgerRefType.return_order,
      referenceId: ctx.returnOrderId,
      operatorId: ctx.operatorId,
    });

    if (line.packageId) {
      await tx.package.updateMany({
        where: { id: line.packageId },
        data: { status: 'returned', updatedAt: new Date() },
      });
    }

    await tx.returnOrderLine.update({
      where: { id: line.id },
      data: {
        postedQuantity: line.receivedQuantity,
        postedAt: new Date(),
        lineStatus: ReturnLineStatus.posted,
      },
    });
  }

  private movementTypeForDisposition(disposition: ReturnItemDisposition): MovementType {
    const d = normalizeReturnDisposition(disposition);
    if (d === ReturnItemDisposition.discard) {
      return MovementType.scrap;
    }
    if (d === ReturnItemDisposition.quarantine || d === ReturnItemDisposition.damaged) {
      return MovementType.qc_quarantine;
    }
    return MovementType.return_receive;
  }

  private async setStockStatus(
    tx: Tx,
    m: {
      companyId: string;
      productId: string;
      locationId: string;
      lotId: string | null;
      status: StockStatus;
    },
  ): Promise<void> {
    const lotId = m.lotId;
    if (lotId) {
      await tx.$executeRaw`
        UPDATE current_stock
           SET status = ${m.status}::stock_status,
               last_movement_at = NOW()
         WHERE company_id = ${m.companyId}::uuid
           AND product_id = ${m.productId}::uuid
           AND location_id = ${m.locationId}::uuid
           AND lot_id = ${lotId}::uuid
           AND package_id IS NULL
      `;
    } else {
      await tx.$executeRaw`
        UPDATE current_stock
           SET status = ${m.status}::stock_status,
               last_movement_at = NOW()
         WHERE company_id = ${m.companyId}::uuid
           AND product_id = ${m.productId}::uuid
           AND location_id = ${m.locationId}::uuid
           AND lot_id IS NULL
           AND package_id IS NULL
      `;
    }
  }
}
