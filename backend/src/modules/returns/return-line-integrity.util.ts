import { BadRequestException } from '@nestjs/common';
import { Prisma, ReturnItemDisposition } from '@prisma/client';

import { MAX_RETURN_LINES_PER_ORDER } from './returns.constants';
import { CreateReturnOrderLineDto } from './dto/create-return-order-line.dto';

export type ReturnListLineSlice = {
  expectedQuantity: Prisma.Decimal;
  receivedQuantity: Prisma.Decimal;
  disposition: ReturnItemDisposition | null;
  product: { sku: string };
};

export type ReturnOrderListSummary = {
  lineCount: number;
  productSummary: string;
  totalExpected: string;
  totalReceived: string;
  dispositionSummary: string | null;
};

/** Reject duplicate buckets in a single create payload (prevents inflated qty via split lines). */
export function assertUniqueReturnLineBuckets(lines: CreateReturnOrderLineDto[]): void {
  if (lines.length > MAX_RETURN_LINES_PER_ORDER) {
    throw new BadRequestException(
      `A return order cannot exceed ${MAX_RETURN_LINES_PER_ORDER} lines.`,
    );
  }

  const seenOutboundLine = new Set<string>();
  const seenProductLot = new Set<string>();

  for (const line of lines) {
    if (line.outboundOrderLineId) {
      if (seenOutboundLine.has(line.outboundOrderLineId)) {
        throw new BadRequestException(
          'Duplicate outbound order line in return payload. Merge quantities into one line.',
        );
      }
      seenOutboundLine.add(line.outboundOrderLineId);
      continue;
    }
    const key = `${line.productId}:${line.lotId ?? ''}`;
    if (seenProductLot.has(key)) {
      throw new BadRequestException(
        'Duplicate product/lot in return payload. Merge quantities into one line.',
      );
    }
    seenProductLot.add(key);
  }
}

export function buildReturnListSummary(lines: ReturnListLineSlice[]): ReturnOrderListSummary {
  const skus = [...new Set(lines.map((l) => l.product.sku))];
  const productSummary =
    skus.length === 0
      ? '—'
      : skus.length <= 3
        ? skus.join(', ')
        : `${skus.slice(0, 2).join(', ')} +${skus.length - 2}`;

  const totalExpected = lines.reduce(
    (sum, l) => sum.add(l.expectedQuantity),
    new Prisma.Decimal(0),
  );
  const totalReceived = lines.reduce(
    (sum, l) => sum.add(l.receivedQuantity),
    new Prisma.Decimal(0),
  );

  const dispositions = [
    ...new Set(lines.map((l) => l.disposition).filter((d): d is ReturnItemDisposition => !!d)),
  ];
  let dispositionSummary: string | null = null;
  if (dispositions.length === 1) {
    dispositionSummary = dispositions[0]!;
  } else if (dispositions.length > 1) {
    dispositionSummary = 'mixed';
  }

  return {
    lineCount: lines.length,
    productSummary,
    totalExpected: totalExpected.toString(),
    totalReceived: totalReceived.toString(),
    dispositionSummary,
  };
}
