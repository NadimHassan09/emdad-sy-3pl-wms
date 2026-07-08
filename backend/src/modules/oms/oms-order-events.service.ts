import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';

type Tx = Prisma.TransactionClient;

@Injectable()
export class OmsOrderEventsService {
  constructor(private readonly prisma: PrismaService) {}

  async record(
    tx: Tx,
    params: {
      outboundOrderId: string;
      companyId: string;
      eventType: string;
      createdBy?: string;
      payload?: Record<string, unknown>;
    },
  ): Promise<void> {
    await tx.omsOrderEvent.create({
      data: {
        outboundOrderId: params.outboundOrderId,
        companyId: params.companyId,
        eventType: params.eventType,
        createdBy: params.createdBy,
        payload: params.payload as Prisma.InputJsonValue | undefined,
      },
    });
  }

  listForOrder(outboundOrderId: string) {
    return this.prisma.omsOrderEvent.findMany({
      where: { outboundOrderId },
      orderBy: { createdAt: 'asc' },
      include: {
        creator: { select: { id: true, fullName: true } },
      },
    });
  }
}
