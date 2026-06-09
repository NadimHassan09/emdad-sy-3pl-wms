import { Injectable } from '@nestjs/common';
import {
  InboundOrderStatus,
  OutboundOrderStatus,
  UserRole,
} from '@prisma/client';

import { ClientPrincipal } from '../../../common/auth/client-principal.types';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { BillingUsageService } from '../../billing/billing-usage.service';
import { ClientBillingService } from '../billing/client-billing.service';

const INBOUND_OPEN: InboundOrderStatus[] = [
  InboundOrderStatus.draft,
  InboundOrderStatus.pending_approval,
  InboundOrderStatus.confirmed,
  InboundOrderStatus.in_progress,
  InboundOrderStatus.partially_received,
];

const OUTBOUND_OPEN: OutboundOrderStatus[] = [
  OutboundOrderStatus.draft,
  OutboundOrderStatus.pending_approval,
  OutboundOrderStatus.pending_stock,
  OutboundOrderStatus.confirmed,
  OutboundOrderStatus.picking,
  OutboundOrderStatus.packing,
  OutboundOrderStatus.ready_to_ship,
];

const EXPIRY_HORIZON_DAYS = 90;

@Injectable()
export class ClientDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usage: BillingUsageService,
    private readonly billing: ClientBillingService,
  ) {}

  async getOverview(client: ClientPrincipal) {
    const companyId = client.companyId;
    const isAdmin = client.role === UserRole.client_admin;

    const expiryBefore = new Date();
    expiryBefore.setUTCDate(expiryBefore.getUTCDate() + EXPIRY_HORIZON_DAYS);

    const [
      productsCount,
      openInboundOrders,
      openOutboundOrders,
      expiringProductsCount,
      usageTotals,
      billingSummary,
      recentInvoiceRows,
    ] = await Promise.all([
      this.prisma.product.count({ where: { companyId, status: 'active' } }),
      this.prisma.inboundOrder.count({
        where: { companyId, status: { in: INBOUND_OPEN } },
      }),
      this.prisma.outboundOrder.count({
        where: { companyId, status: { in: OUTBOUND_OPEN } },
      }),
      this.countExpiringProducts(companyId, expiryBefore),
      this.usage.getCompanyUsage(companyId),
      isAdmin ? this.billing.getSummary(client).catch(() => null) : Promise.resolve(null),
      isAdmin
        ? this.prisma.invoice.findMany({
            where: { companyId },
            orderBy: { createdAt: 'desc' },
            take: 5,
            select: {
              id: true,
              invoiceNumber: true,
              status: true,
              totalAmount: true,
              issuedAt: true,
              createdAt: true,
            },
          })
        : Promise.resolve([]),
    ]);

    const reservedVolume = billingSummary?.reservedVolume ?? null;
    const reservedWeight = billingSummary?.reservedWeight ?? null;
    const usedVolume = usageTotals.volumeCbm;
    const usedWeight = usageTotals.weightKg;

    let storageUtilizationPercent: number | null = null;
    if (reservedVolume) {
      const reserved = Number(reservedVolume);
      const used = Number(usedVolume);
      if (Number.isFinite(reserved) && reserved > 0 && Number.isFinite(used)) {
        storageUtilizationPercent = Math.min(100, Math.round((used / reserved) * 1000) / 10);
      }
    }

    return {
      productsCount,
      openInboundOrders,
      openOutboundOrders,
      activeOrders: openInboundOrders + openOutboundOrders,
      expiringProductsCount,
      storage: {
        usedVolumeCbm: usedVolume.toString(),
        usedWeightKg: usedWeight.toString(),
        reservedVolumeCbm: reservedVolume,
        reservedWeightKg: reservedWeight,
        utilizationPercent: storageUtilizationPercent,
      },
      billing: billingSummary
        ? {
            daysUntilExpiration: billingSummary.daysRemaining,
            currentInvoiceAmount: billingSummary.currentInvoice?.totalAmount ?? null,
            accountStatus: billingSummary.accountStatus,
          }
        : null,
      recentInvoices: isAdmin
        ? recentInvoiceRows.map((row) => ({
            id: row.id,
            invoiceNumber: row.invoiceNumber,
            status: row.status,
            totalAmount: row.totalAmount.toString(),
            issuedAt: row.issuedAt?.toISOString() ?? null,
            createdAt: row.createdAt.toISOString(),
          }))
        : [],
    };
  }

  private async countExpiringProducts(companyId: string, expiryBefore: Date): Promise<number> {
    const rows = await this.prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(DISTINCT cs.product_id)::bigint AS count
      FROM current_stock cs
      INNER JOIN lots l ON l.id = cs.lot_id
      WHERE cs.company_id = ${companyId}::uuid
        AND cs.quantity_on_hand > 0
        AND l.expiry_date IS NOT NULL
        AND l.expiry_date <= ${expiryBefore}::date
    `;
    return Number(rows[0]?.count ?? 0);
  }
}
