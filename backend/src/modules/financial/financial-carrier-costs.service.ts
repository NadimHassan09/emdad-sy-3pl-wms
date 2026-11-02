import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class FinancialCarrierCostsService {
  constructor(private readonly prisma: PrismaService) {}

  async listCarrierCosts(params: {
    page?: number;
    limit?: number;
    providerCode?: string;
    search?: string;
    paidStatus?: 'paid' | 'unpaid' | 'all';
  }) {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 25));
    const skip = (page - 1) * limit;

    const where: Prisma.CarrierShipmentWhereInput = {
      ...(params.providerCode ? { providerCode: params.providerCode } : {}),
      ...(params.paidStatus === 'paid'
        ? { costPaidAt: { not: null } }
        : params.paidStatus === 'unpaid'
          ? { costPaidAt: null }
          : {}),
      ...(params.search
        ? {
            OR: [
              { externalAwb: { contains: params.search, mode: 'insensitive' } },
              { trackingNumber: { contains: params.search, mode: 'insensitive' } },
              { outboundOrder: { orderNumber: { contains: params.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [total, items] = await Promise.all([
      this.prisma.carrierShipment.count({ where }),
      this.prisma.carrierShipment.findMany({
        where,
        skip,
        take: limit,
        include: {
          provider: { select: { id: true, code: true, name: true } },
          outboundOrder: {
            select: {
              id: true,
              orderNumber: true,
              companyId: true,
              company: { select: { id: true, name: true } },
            },
          },
          costChanges: {
            orderBy: { createdAt: 'desc' },
            take: 5,
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const serialized = items.map((s) => ({
      id: s.id,
      outboundOrderId: s.outboundOrderId,
      outboundOrderNumber: s.outboundOrder?.orderNumber,
      clientName: s.outboundOrder?.company?.name,
      providerCode: s.providerCode,
      providerName: s.provider?.name ?? s.providerCode,
      externalAwb: s.externalAwb,
      trackingNumber: s.trackingNumber,
      status: s.status,
      shippingCost: s.shippingCost ? s.shippingCost.toString() : null,
      currency: s.currency ?? 'USD',
      shippingCostSource: s.shippingCostSource,
      shippingCostEventAt: s.shippingCostEventAt,
      costPaidAt: s.costPaidAt,
      costPaidReference: s.costPaidReference,
      recentCostChanges: s.costChanges.map((c) => ({
        id: c.id,
        amount: c.amount.toString(),
        currency: c.currency,
        source: c.source,
        skipReason: c.skipReason,
        applied: c.applied,
        eventAt: c.eventAt,
        createdAt: c.createdAt,
      })),
      createdAt: s.createdAt,
    }));

    return {
      items: serialized,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async markCarrierCostPaid(
    carrierShipmentId: string,
    params: { reference?: string; notes?: string },
  ) {
    const shipment = await this.prisma.carrierShipment.findUnique({
      where: { id: carrierShipmentId },
    });
    if (!shipment) throw new NotFoundException('Carrier shipment not found');

    const updated = await this.prisma.carrierShipment.update({
      where: { id: carrierShipmentId },
      data: {
        costPaidAt: new Date(),
        costPaidReference: params.reference ?? null,
      },
    });

    return updated;
  }
}
