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
      omsOrderId?: string;
      outboundOrderId?: string;
      companyId: string;
      eventType: string;
      createdBy?: string;
      payload?: Record<string, unknown>;
    },
  ): Promise<void> {
    if (!params.omsOrderId && !params.outboundOrderId) {
      throw new Error('OMS event requires omsOrderId or outboundOrderId.');
    }
    await tx.omsOrderEvent.create({
      data: {
        omsOrderId: params.omsOrderId,
        outboundOrderId: params.outboundOrderId,
        companyId: params.companyId,
        eventType: params.eventType,
        createdBy: params.createdBy,
        payload: params.payload as Prisma.InputJsonValue | undefined,
      },
    });
  }

  listForOrder(omsOrderId: string) {
    return this.prisma.omsOrderEvent.findMany({
      where: { omsOrderId },
      orderBy: { createdAt: 'asc' },
      include: {
        creator: { select: { id: true, fullName: true } },
      },
    });
  }

  listForOrderTx(tx: Tx, omsOrderId: string) {
    return tx.omsOrderEvent.findMany({
      where: { omsOrderId },
      orderBy: { createdAt: 'asc' },
      select: { eventType: true, payload: true },
    });
  }

  listForOutboundOrder(outboundOrderId: string) {
    return this.prisma.omsOrderEvent.findMany({
      where: { outboundOrderId },
      orderBy: { createdAt: 'asc' },
      include: {
        creator: { select: { id: true, fullName: true } },
      },
    });
  }
}
