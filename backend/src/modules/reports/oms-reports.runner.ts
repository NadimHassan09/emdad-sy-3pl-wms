import { Injectable } from '@nestjs/common';
import { OutboundOrderStatus, OmsCodStatus, OmsAllocationStatus, Prisma, ReservationStatus } from '@prisma/client';

import { AuthPrincipal } from '../../common/auth/current-user.types';
import { readCompanyIdCatalogFilter } from '../../common/auth/company-read-scope';
import { CompanyAccessService } from '../../common/company-access/company-access.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { RunReportQueryDto } from './dto/run-report-query.dto';
import type { ReportRowDto } from './reports.service';

const SAMPLE_CAP = 2000;

function paginate<T>(rows: T[], limit: number, offset: number) {
  return {
    items: rows.slice(offset, offset + limit),
    total: rows.length,
  };
}

function fmtDate(iso: string | Date | null | undefined): string {
  if (!iso) return '';
  return typeof iso === 'string' ? iso.slice(0, 10) : iso.toISOString().slice(0, 10);
}

function fmtDateTime(iso: string | Date | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().replace('T', ' ').slice(0, 19);
}

function dec(v: Prisma.Decimal | null | undefined): string {
  if (v == null) return '0';
  return v.toString();
}

@Injectable()
export class OmsReportsRunner {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyAccess: CompanyAccessService,
  ) {}

  async run(
    user: AuthPrincipal,
    reportId: string,
    query: RunReportQueryDto,
  ): Promise<{ items: ReportRowDto[]; total: number }> {
    switch (reportId) {
      case 'cod-report':
        return this.codReport(user, query);
      case 'merchant-orders':
        return this.merchantOrders(user, query);
      case 'sales-report':
        return this.salesReport(user, query);
      case 'returns-report':
        return this.returnsReport(user, query);
      case 'delivery-report':
        return this.deliveryReport(user, query);
      case 'allocation-report':
        return this.allocationReport(user, query);
      case 'inventory-reserved':
        return this.inventoryReserved(user, query);
      default:
        return { items: [], total: 0 };
    }
  }

  private companyFilter(user: AuthPrincipal, query: RunReportQueryDto): string | undefined {
    return readCompanyIdCatalogFilter(this.companyAccess, user, query.companyId);
  }

  private dateFilter(query: RunReportQueryDto): Prisma.DateTimeFilter | undefined {
    if (!query.dateFrom && !query.dateTo) return undefined;
    const createdAt: Prisma.DateTimeFilter = {};
    if (query.dateFrom) createdAt.gte = new Date(`${query.dateFrom}T00:00:00.000Z`);
    if (query.dateTo) createdAt.lte = new Date(`${query.dateTo}T23:59:59.999Z`);
    return createdAt;
  }

  private async codReport(user: AuthPrincipal, query: RunReportQueryDto) {
    const companyId = this.companyFilter(user, query);
    const where: Prisma.OutboundOrderWhereInput = {
      paymentMethod: 'COD',
      ...(companyId ? { companyId } : {}),
      ...(query.status && Object.values(OmsCodStatus).includes(query.status as OmsCodStatus)
        ? { codStatus: query.status as OmsCodStatus }
        : {}),
    };
    const date = this.dateFilter(query);
    if (date) where.createdAt = date;

    const orders = await this.prisma.outboundOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: SAMPLE_CAP,
      include: { company: { select: { name: true } } },
    });

    const rows: ReportRowDto[] = orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      client: o.company?.name ?? '',
      recipient: o.recipientName ?? '',
      codAmount: dec(o.codAmount),
      codStatus: o.codStatus ?? '',
      currency: o.currency ?? '',
      collectedAt: fmtDateTime(o.codCollectedAt),
      remittedAt: fmtDateTime(o.codRemittedAt),
      orderStatus: o.status,
      createdAt: fmtDateTime(o.createdAt),
    }));

    return paginate(rows, query.limit, query.offset);
  }

  private async merchantOrders(user: AuthPrincipal, query: RunReportQueryDto) {
    const companyId = this.companyFilter(user, query);
    const where: Prisma.OutboundOrderWhereInput = {
      ...(companyId ? { companyId } : {}),
      ...(query.status ? { status: query.status as OutboundOrderStatus } : {}),
    };
    const date = this.dateFilter(query);
    if (date) where.createdAt = date;

    const orders = await this.prisma.outboundOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: SAMPLE_CAP,
      include: {
        company: { select: { name: true } },
        _count: { select: { lines: true } },
      },
    });

    const rows: ReportRowDto[] = orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      client: o.company?.name ?? '',
      status: o.status,
      recipient: o.recipientName ?? '',
      city: o.city ?? '',
      paymentMethod: o.paymentMethod ?? '',
      allocationStatus: o.allocationStatus ?? '',
      lineCount: o._count.lines,
      createdAt: fmtDateTime(o.createdAt),
    }));

    return paginate(rows, query.limit, query.offset);
  }

  private async salesReport(user: AuthPrincipal, query: RunReportQueryDto) {
    const companyId = this.companyFilter(user, query);
    const where: Prisma.OutboundOrderWhereInput = {
      ...(companyId ? { companyId } : {}),
      status: {
        in: [
          OutboundOrderStatus.delivered,
          OutboundOrderStatus.shipped,
          OutboundOrderStatus.out_for_delivery,
        ],
      },
    };
    const date = this.dateFilter(query);
    if (date) where.createdAt = date;

    const orders = await this.prisma.outboundOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: SAMPLE_CAP,
      include: {
        company: { select: { name: true } },
        lines: { select: { lineTotal: true, unitPrice: true, requestedQuantity: true } },
      },
    });

    const rows: ReportRowDto[] = orders.map((o) => {
      const lineTotal = o.lines.reduce(
        (sum, l) => sum + Number(l.lineTotal ?? 0),
        0,
      );
      const subtotal = o.subtotal ? Number(o.subtotal) : lineTotal;
      const shipping = o.shippingFee ? Number(o.shippingFee) : 0;
      return {
        id: o.id,
        orderNumber: o.orderNumber,
        client: o.company?.name ?? '',
        subtotal: dec(o.subtotal) || String(subtotal),
        shippingFee: dec(o.shippingFee) || String(shipping),
        total: String(subtotal + shipping),
        currency: o.currency ?? '',
        paymentMethod: o.paymentMethod ?? '',
        deliveredAt: fmtDateTime(o.deliveredAt ?? o.shippedAt),
      };
    });

    return paginate(rows, query.limit, query.offset);
  }

  private async returnsReport(user: AuthPrincipal, query: RunReportQueryDto) {
    const companyId = this.companyFilter(user, query);
    const where: Prisma.OutboundOrderWhereInput = {
      status: OutboundOrderStatus.returned,
      ...(companyId ? { companyId } : {}),
    };
    const date = this.dateFilter(query);
    if (date) where.returnedAt = date;

    const orders = await this.prisma.outboundOrder.findMany({
      where,
      orderBy: { returnedAt: 'desc' },
      take: SAMPLE_CAP,
      include: { company: { select: { name: true } } },
    });

    const rows: ReportRowDto[] = orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      client: o.company?.name ?? '',
      recipient: o.recipientName ?? '',
      returnedAt: fmtDateTime(o.returnedAt),
      codAmount: dec(o.codAmount),
      paymentMethod: o.paymentMethod ?? '',
    }));

    return paginate(rows, query.limit, query.offset);
  }

  private async deliveryReport(user: AuthPrincipal, query: RunReportQueryDto) {
    const companyId = this.companyFilter(user, query);
    const where: Prisma.OutboundOrderWhereInput = {
      ...(companyId ? { companyId } : {}),
      status: {
        in: [
          OutboundOrderStatus.out_for_delivery,
          OutboundOrderStatus.delivered,
          OutboundOrderStatus.shipped,
        ],
      },
    };
    const date = this.dateFilter(query);
    if (date) {
      where.OR = [
        { outForDeliveryAt: date },
        { deliveredAt: date },
        { shippedAt: date },
      ];
    }

    const orders = await this.prisma.outboundOrder.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: SAMPLE_CAP,
      include: { company: { select: { name: true } } },
    });

    const rows: ReportRowDto[] = orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      client: o.company?.name ?? '',
      status: o.status,
      carrier: o.carrier ?? '',
      trackingNumber: o.trackingNumber ?? '',
      city: o.city ?? '',
      outForDeliveryAt: fmtDateTime(o.outForDeliveryAt),
      deliveredAt: fmtDateTime(o.deliveredAt ?? o.shippedAt),
    }));

    return paginate(rows, query.limit, query.offset);
  }

  private async allocationReport(user: AuthPrincipal, query: RunReportQueryDto) {
    const companyId = this.companyFilter(user, query);
    const where: Prisma.OutboundOrderWhereInput = {
      ...(companyId ? { companyId } : {}),
      allocationStatus: query.status && Object.values(OmsAllocationStatus).includes(query.status as OmsAllocationStatus)
        ? (query.status as OmsAllocationStatus)
        : { in: [OmsAllocationStatus.allocated, OmsAllocationStatus.released, OmsAllocationStatus.fulfilled] },
    };
    const date = this.dateFilter(query);
    if (date) where.createdAt = date;

    const orders = await this.prisma.outboundOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: SAMPLE_CAP,
      include: {
        company: { select: { name: true } },
        _count: { select: { stockReservations: true } },
      },
    });

    const rows: ReportRowDto[] = orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      client: o.company?.name ?? '',
      orderStatus: o.status,
      allocationStatus: o.allocationStatus ?? '',
      reservationCount: o._count.stockReservations,
      allocatedAt: fmtDateTime(o.allocatedAt),
    }));

    return paginate(rows, query.limit, query.offset);
  }

  private async inventoryReserved(user: AuthPrincipal, query: RunReportQueryDto) {
    const companyId = this.companyFilter(user, query);
    const where: Prisma.StockReservationWhereInput = {
      status: ReservationStatus.active,
      ...(companyId ? { companyId } : {}),
    };

    const reservations = await this.prisma.stockReservation.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: SAMPLE_CAP,
      include: {
        product: { select: { sku: true, name: true } },
        company: { select: { name: true } },
        outboundOrder: { select: { orderNumber: true } },
        location: { select: { fullPath: true } },
        lot: { select: { lotNumber: true } },
      },
    });

    const rows: ReportRowDto[] = reservations.map((r) => ({
      id: r.id,
      orderNumber: r.outboundOrder?.orderNumber ?? '',
      client: r.company?.name ?? '',
      sku: r.product?.sku ?? '',
      product: r.product?.name ?? '',
      location: r.location?.fullPath ?? '',
      lot: r.lot?.lotNumber ?? '',
      quantity: r.quantity.toString(),
      status: r.status,
      createdAt: fmtDateTime(r.createdAt),
    }));

    return paginate(rows, query.limit, query.offset);
  }
}
